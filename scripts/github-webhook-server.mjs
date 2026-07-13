import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const host = process.env.WEBHOOK_HOST || '127.0.0.1';
const port = Number(process.env.WEBHOOK_PORT || 9010);
const secret = process.env.GITHUB_WEBHOOK_SECRET;
const expectedRepository = process.env.GITHUB_REPOSITORY || 'nmarquev/tastebox';
const expectedRef = `refs/heads/${process.env.DEPLOY_BRANCH || 'main'}`;
const maxBodyBytes = 1024 * 1024;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const deployRunner = path.join(scriptDir, 'run-webhook-deploy.sh');
const recentDeliveries = new Set();

if (!secret || secret.length < 32) {
  throw new Error('GITHUB_WEBHOOK_SECRET debe tener al menos 32 caracteres.');
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function signatureIsValid(body, signatureHeader) {
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const received = Buffer.from(signatureHeader.slice(7), 'hex');
  const expected = createHmac('sha256', secret).update(body).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function rememberDelivery(deliveryId) {
  if (!deliveryId) return true;
  if (recentDeliveries.has(deliveryId)) return false;

  recentDeliveries.add(deliveryId);
  const timer = setTimeout(() => recentDeliveries.delete(deliveryId), 10 * 60 * 1000);
  timer.unref();
  return true;
}

function launchDeploy(deliveryId) {
  const child = spawn('/bin/bash', [deployRunner], {
    detached: true,
    env: { ...process.env, GITHUB_DELIVERY_ID: deliveryId || 'unknown' },
    stdio: 'ignore',
  });
  child.unref();
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    return sendJson(response, 200, { status: 'ok' });
  }

  if (request.method !== 'POST' || request.url !== '/deploy/github') {
    return sendJson(response, 404, { error: 'Not found' });
  }

  const chunks = [];
  let bodySize = 0;
  let bodyRejected = false;

  request.on('data', (chunk) => {
    if (bodyRejected) return;
    bodySize += chunk.length;
    if (bodySize > maxBodyBytes) {
      bodyRejected = true;
      response.writeHead(413);
      response.end();
      return;
    }
    chunks.push(chunk);
  });

  request.on('end', () => {
    if (bodyRejected) return;
    const body = Buffer.concat(chunks);
    const signature = request.headers['x-hub-signature-256'];

    if (!signatureIsValid(body, signature)) {
      return sendJson(response, 401, { error: 'Invalid signature' });
    }

    const event = request.headers['x-github-event'];
    if (event === 'ping') {
      return sendJson(response, 200, { message: 'pong' });
    }
    if (event !== 'push') {
      return sendJson(response, 202, { message: 'Event ignored' });
    }

    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return sendJson(response, 400, { error: 'Invalid JSON' });
    }

    if (payload.repository?.full_name !== expectedRepository || payload.ref !== expectedRef) {
      return sendJson(response, 202, { message: 'Repository or branch ignored' });
    }

    const deliveryId = String(request.headers['x-github-delivery'] || '');
    if (!rememberDelivery(deliveryId)) {
      return sendJson(response, 202, { message: 'Delivery already processed' });
    }

    launchDeploy(deliveryId);
    console.log(`${new Date().toISOString()} deploy accepted: ${deliveryId || 'unknown'}`);
    return sendJson(response, 202, { message: 'Deploy accepted' });
  });

  request.on('error', (error) => {
    console.error(`${new Date().toISOString()} request error: ${error.message}`);
    if (!response.headersSent) sendJson(response, 400, { error: 'Invalid request' });
  });
});

server.listen(port, host, () => {
  console.log(`TasteBox webhook listening on http://${host}:${port}`);
});

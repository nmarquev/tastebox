// Credenciales de Cookidoo persistidas en disco. La contraseña se guarda CIFRADA
// (AES-256-GCM con clave derivada de JWT_SECRET), no en texto plano.
// Se usan para que el servidor inicie sesión en Cookidoo y pueda importar recetas
// por URL con la preparación completa (que en la web pública está detrás del login).
import './env';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SETTINGS_PATH = path.join(__dirname, '../../config/cookidoo-settings.json');

interface StoredCookidooSettings {
  username?: string;
  // Contraseña cifrada en formato "iv:authTag:ciphertext" (hex). Nunca en texto plano.
  passwordEnc?: string;
}

// Clave de cifrado de 32 bytes derivada del JWT_SECRET del entorno.
function getKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'tastebox-default-secret';
  return crypto.scryptSync(secret, 'cookidoo-creds-salt', 32);
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(payload: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null; // clave cambiada o dato corrupto
  }
}

let cache: StoredCookidooSettings | null = null;

function load(): StoredCookidooSettings {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    cache = {};
  }
  return cache!;
}

// Credenciales descifradas para uso interno (login). Devuelve null si no están completas.
export function getCookidooCredentials(): { username: string; password: string } | null {
  const s = load();
  if (!s.username || !s.passwordEnc) return null;
  const password = decrypt(s.passwordEnc);
  if (!password) return null;
  return { username: s.username, password };
}

// Estado para la UI: si hay credenciales configuradas, sin exponer la contraseña.
export function getCookidooSettingsStatus() {
  const s = load();
  return {
    configured: Boolean(s.username && s.passwordEnc),
    username: s.username || '',
  };
}

// Guarda/actualiza credenciales. username o password vacíos borran la configuración.
export function updateCookidooSettings(patch: { username?: string; password?: string }) {
  const current = { ...load() };

  if (patch.username !== undefined) {
    const v = patch.username.trim();
    if (v) current.username = v;
    else delete current.username;
  }
  if (patch.password !== undefined) {
    const v = patch.password; // no trim: las contraseñas pueden tener espacios
    if (v) current.passwordEnc = encrypt(v);
    else delete current.passwordEnc;
  }

  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(current, null, 2));
  cache = current;
  return getCookidooSettingsStatus();
}

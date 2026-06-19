// IMPORTANT: Load environment variables FIRST
import './config/env';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import https from 'https';
import fs from 'fs';
import cookieParser from 'cookie-parser';

// Import routes
import authRoutes from './routes/auth';
import recipeRoutes from './routes/recipes';
import importRoutes from './routes/importImproved';
import importHtmlRoutes from './routes/importHtml';
import importDocxRoutes from './routes/importDocx';
import uploadRoutes from './routes/upload';
import llmRoutes from './routes/llm';
import profilePhotoRoutes from './routes/profilePhoto';
import imageProxyRoutes from './routes/imageProxy';
import nutritionRoutes from './routes/nutrition';
import pdfRoutes from './routes/pdf';
import testPdfRoutes from './routes/testPdf';
import settingsRoutes from './routes/settings';
import collectionRoutes from './routes/collections';
import categoryRoutes from './routes/categories';
import dishTypeRoutes from './routes/dishTypes';
import sourceRoutes from './routes/sources';
import tagRoutes from './routes/tags';
import authorRoutes from './routes/authors';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir recursos cross-origin
}));
app.use(cors({
  origin: function(origin, callback) {
    // En desarrollo, permitir cualquier origen explícitamente (no usar 'true' con credentials)
    // En producción, lista blanca de dominios permitidos
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://tastebox.beweb.com.ar',
        'chrome-extension://*' // Permitir extensión Chrome en producción
      ];

      // En producción, permitir mismo origen y extensiones Chrome
      if (!origin || allowedOrigins.some(allowed =>
        allowed.includes('*') ? origin.startsWith(allowed.replace('*', '')) : origin === allowed
      )) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // En desarrollo, permitir:
      // - Orígenes web normales (localhost:8080, etc.)
      // - Chrome extensions (chrome-extension://...)
      // - Requests sin origin header (ej: extensiones, Postman, etc.)
      if (!origin || origin.startsWith('chrome-extension://') || origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
        callback(null, origin || 'http://localhost:8080');
      } else {
        callback(null, origin); // En dev, permitir cualquier origen
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/import', importRoutes);
app.use('/api/import-html', importHtmlRoutes);
app.use('/api/import/docx', importDocxRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/upload', profilePhotoRoutes);
app.use('/api/proxy', imageProxyRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/test', testPdfRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dish-types', dishTypeRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/authors', authorRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TasteBox Recipe API',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'La imagen debe tener un tamaño menor a 2MB',
      message: 'La imagen debe tener un tamaño menor a 2MB'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler - Frontend lo sirve Nginx en producción
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// SSL Configuration
const isSSLEnabled = process.env.SSL_ENABLED !== 'false'; // Default to true
let server;

if (isSSLEnabled) {
  try {
    const privateKey = fs.readFileSync(path.join(__dirname, '../ssl/tastebox-local-key.pem'), 'utf8');
    const certificate = fs.readFileSync(path.join(__dirname, '../ssl/tastebox-local-cert.pem'), 'utf8');

    const httpsOptions = {
      key: privateKey,
      cert: certificate
    };

    server = https.createServer(httpsOptions, app);
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🔒 HTTPS Server running on port ${PORT}`);
      console.log(`🌐 Server accessible on all network interfaces`);
      console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR || './uploads'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 SSL Certificate: localhost-cert.pem`);
      console.log(`🔑 Access URLs:`);
      console.log(`   - https://localhost:${PORT}`);
      console.log(`   - https://127.0.0.1:${PORT}`);
      console.log(`   - https://192.168.0.10:${PORT}`);
    });
  } catch (error) {
    console.error('❌ SSL Certificate not found, falling back to HTTP:', error instanceof Error ? error.message : String(error));
    server = app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 HTTP Server running on port ${PORT} (SSL disabled)`);
      console.log(`🌐 Server accessible on all network interfaces`);
    });
  }
} else {
  server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 HTTP Server running on port ${PORT} (SSL disabled)`);
    console.log(`🌐 Server accessible on all network interfaces`);
    console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR || './uploads'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

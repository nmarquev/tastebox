import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAiSettings, updateAiSettings } from '../config/aiSettings';
import {
  getCookidooSettingsStatus,
  updateCookidooSettings,
  getCookidooCredentials,
} from '../config/cookidooSettings';
import {
  getFooditSettingsStatus,
  updateFooditSettings,
  getFooditCredentials,
} from '../config/fooditSettings';
import { CookidooService } from '../services/cookidooService';
import { FooditService } from '../services/fooditService';

const router = express.Router();

// Current effective AI model settings (override + env defaults).
router.get('/ai', authenticateToken, (req, res) => {
  res.json(getAiSettings());
});

// Update the runtime model override. Empty string reverts to env default.
router.put('/ai', authenticateToken, (req, res) => {
  const { model, visionModel } = req.body ?? {};

  if (model !== undefined && typeof model !== 'string') {
    return res.status(400).json({ error: 'model debe ser un string' });
  }
  if (visionModel !== undefined && typeof visionModel !== 'string') {
    return res.status(400).json({ error: 'visionModel debe ser un string' });
  }

  res.json(updateAiSettings({ model, visionModel }));
});

// Estado de las credenciales de Cookidoo (sin exponer la contraseña).
router.get('/cookidoo', authenticateToken, (req, res) => {
  res.json(getCookidooSettingsStatus());
});

// Guardar/actualizar credenciales de Cookidoo. Contraseña vacía borra la config.
router.put('/cookidoo', authenticateToken, (req, res) => {
  const { username, password } = req.body ?? {};

  if (username !== undefined && typeof username !== 'string') {
    return res.status(400).json({ error: 'username debe ser un string' });
  }
  if (password !== undefined && typeof password !== 'string') {
    return res.status(400).json({ error: 'password debe ser un string' });
  }

  res.json(updateCookidooSettings({ username, password }));
});

// Probar el login con las credenciales guardadas (no extrae receta, solo valida).
const cookidooService = new CookidooService();
router.post('/cookidoo/test', authenticateToken, async (req, res) => {
  const creds = getCookidooCredentials();
  if (!creds) {
    return res.status(400).json({ ok: false, error: 'No hay credenciales de Cookidoo configuradas.' });
  }
  try {
    await cookidooService.verifyLogin(creds);
    res.json({ ok: true, message: 'Login de Cookidoo correcto.' });
  } catch (error) {
    res.status(401).json({ ok: false, error: error instanceof Error ? error.message : 'Error de login' });
  }
});

// Estado de las credenciales de Foodit / La Nación (sin exponer la contraseña).
router.get('/foodit', authenticateToken, (req, res) => {
  res.json(getFooditSettingsStatus());
});

// Guardar/actualizar credenciales de Foodit. Contraseña vacía borra la config.
router.put('/foodit', authenticateToken, (req, res) => {
  const { username, password } = req.body ?? {};

  if (username !== undefined && typeof username !== 'string') {
    return res.status(400).json({ error: 'username debe ser un string' });
  }
  if (password !== undefined && typeof password !== 'string') {
    return res.status(400).json({ error: 'password debe ser un string' });
  }

  res.json(updateFooditSettings({ username, password }));
});

// Probar el login con las credenciales guardadas (no extrae receta, solo valida).
const fooditService = new FooditService();
router.post('/foodit/test', authenticateToken, async (req, res) => {
  const creds = getFooditCredentials();
  if (!creds) {
    return res.status(400).json({ ok: false, error: 'No hay credenciales de Foodit configuradas.' });
  }
  try {
    await fooditService.verifyLogin(creds);
    res.json({ ok: true, message: 'Login de Foodit correcto.' });
  } catch (error) {
    res.status(401).json({ ok: false, error: error instanceof Error ? error.message : 'Error de login' });
  }
});

export default router;

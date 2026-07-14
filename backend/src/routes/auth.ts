import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';

const router = express.Router();
const prisma = new PrismaClient();

const GOOGLE_STATE_COOKIE = 'tasteboxGoogleOAuthState';
const DEFAULT_GOOGLE_CLIENT_ID = '366572363677-jvsvhomltge2jqjap2kg7am9u5hfs3kt.apps.googleusercontent.com';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:8084';
const getGoogleClientId = () => process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;

const getGoogleRedirectUri = (req: express.Request) => {
  return process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
};

const getSafeReturnTo = (candidate?: string) => {
  const fallback = new URL('/app', getFrontendUrl()).toString();

  try {
    const url = new URL(candidate || fallback);
    const configuredOrigin = new URL(getFrontendUrl()).origin;
    const isLocalDevelopment = process.env.NODE_ENV !== 'production'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');

    return url.origin === configuredOrigin || isLocalDevelopment ? url.toString() : fallback;
  } catch {
    return fallback;
  }
};

const addQueryParam = (url: string, key: string, value: string) => {
  const target = new URL(url);
  target.searchParams.set(key, value);
  return target.toString();
};

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000
};

const createSessionToken = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no configurado');
  }

  return jwt.sign({ userId }, jwtSecret, { expiresIn: '30d' });
};

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  alias: z.string().min(2).optional(),
  password: z.string().min(6)
});

const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  alias: z.string().min(2).optional(),
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(6).optional()
}).refine((data) => {
  // Si se actualiza la contraseña, se requieren tanto la contraseña actual como la nueva
  if (data.newPassword && !data.currentPassword) {
    return false;
  }
  if (data.currentPassword && !data.newPassword) {
    return false;
  }
  return true;
}, {
  message: "Se requieren tanto la contraseña actual como la nueva para cambiar la contraseña"
});

// Iniciar el flujo OAuth de Google. El state se guarda en una cookie HTTP-only
// para validar que el callback corresponde al navegador que inicio el login.
router.get('/google', (req, res) => {
  const clientId = getGoogleClientId();
  const jwtSecret = process.env.JWT_SECRET;

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !jwtSecret) {
    return res.status(503).json({ error: 'El inicio de sesion con Google no esta configurado' });
  }

  const returnTo = getSafeReturnTo(typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined);
  const state = jwt.sign(
    { nonce: crypto.randomBytes(24).toString('hex'), returnTo },
    jwtSecret,
    { expiresIn: '10m', audience: 'tastebox-google-oauth' }
  );

  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 10 * 60 * 1000
  });

  const authorizationUrl = new URL(GOOGLE_AUTH_URL);
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  }).toString();

  return res.redirect(authorizationUrl.toString());
});

// Google vuelve a este endpoint con un codigo de un solo uso. El backend lo
// intercambia por el perfil y crea o vincula la cuenta usando el email verificado.
router.get('/google/callback', async (req, res) => {
  const fallback = getSafeReturnTo();
  const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
  const storedState = req.cookies?.[GOOGLE_STATE_COOKIE];
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/api/auth/google' });

  if (req.query.error) {
    return res.redirect(addQueryParam(fallback, 'google_error', 'access_denied'));
  }

  if (!receivedState || !storedState || receivedState !== storedState || !code) {
    return res.redirect(addQueryParam(fallback, 'google_error', 'invalid_state'));
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    const clientId = getGoogleClientId();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!jwtSecret || !clientId || !clientSecret) {
      throw new Error('Google OAuth no configurado');
    }

    const statePayload = jwt.verify(receivedState, jwtSecret, {
      audience: 'tastebox-google-oauth'
    }) as { returnTo?: string };
    const returnTo = getSafeReturnTo(statePayload.returnTo);

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getGoogleRedirectUri(req)
      })
    });
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) {
      console.error('Google OAuth token exchange failed:', tokens.error, tokens.error_description);
      return res.redirect(addQueryParam(returnTo, 'google_error', 'token_exchange'));
    }

    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const googleProfile = await profileResponse.json() as GoogleUserInfo;
    if (!profileResponse.ok || !googleProfile.email || googleProfile.email_verified !== true) {
      return res.redirect(addQueryParam(returnTo, 'google_error', 'unverified_email'));
    }

    const email = googleProfile.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const generatedPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          email,
          name: googleProfile.name?.trim() || email.split('@')[0],
          password: generatedPassword,
          profilePhoto: googleProfile.picture || null
        }
      });
    }

    const token = createSessionToken(user.id);
    res.cookie('authToken', token, authCookieOptions);
    return res.redirect(addQueryParam(returnTo, 'google_login', 'success'));
  } catch (error) {
    console.error('Error de inicio de sesion con Google:', error);
    return res.redirect(addQueryParam(fallback, 'google_error', 'oauth_failed'));
  }
});

// Convierte la cookie HTTP-only creada por el callback en la sesion que ya usa
// el frontend. El token nunca viaja por la URL de redireccionamiento.
router.get('/google/session', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Autenticacion requerida' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      alias: true,
      profilePhoto: true,
      createdAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  return res.json({ user, token: createSessionToken(user.id) });
});

// Registro
router.post('/register', async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Error de validación', details: result.error.errors });
    }
    const { email, name, alias, password } = result.data;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario con este correo electrónico' });
    }

    // Hashear contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        email,
        name,
        alias,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        name: true,
        alias: true,
        profilePhoto: true,
        createdAt: true
      }
    });

    // Generar JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      user,
      token
    });
  } catch (error) {
    console.error('Error de registro:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Error de validación', details: error.errors });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Inicio de sesión
router.post('/login', async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Error de validación', details: result.error.errors });
    }
    const { email, password } = result.data;

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado');
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    // Establecer cookie HTTP-only segura para acceso con bookmarklet
    // En desarrollo: sameSite 'lax' + secure false para permitir localhost y HTTP
    // En producción: sameSite 'none' + secure true para cross-origin HTTPS
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true en prod (HTTPS), false en dev
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        alias: user.alias,
        profilePhoto: user.profilePhoto,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Error de inicio de sesión:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Error de validación', details: error.errors });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint simple de verificación para bookmarklet
router.get('/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    res.json({
      success: true,
      authenticated: true,
      userId
    });
  } catch (error) {
    console.error('Error de verificación de autenticación:', error);
    res.status(401).json({ error: 'Autenticación fallida' });
  }
});

// Obtener información del usuario actual (para verificación de autenticación con bookmarklet)
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        alias: true,
        profilePhoto: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cerrar sesión (limpiar cookie)
router.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

// Forgot Password - Enviar contraseña por email (SIMPLE - no seguro)
const forgotPasswordSchema = z.object({
  email: z.string().email()
});

router.post('/forgot-password', async (req, res) => {
  try {
    const result = forgotPasswordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Email inválido', details: result.error.errors });
    }

    const { email } = result.data;

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // Por seguridad, siempre retornar éxito (no revelar si el email existe)
    if (!user) {
      console.log(`⚠️ Intento de recuperación para email no existente: ${email}`);
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás las instrucciones para recuperar tu contraseña'
      });
    }

    // Verificar configuración SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('❌ Configuración SMTP no encontrada');
      return res.status(500).json({ error: 'Servicio de email no configurado' });
    }

    // Generar contraseña temporal
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();

    // Hashear la contraseña temporal
    const saltRounds = 12;
    const hashedTempPassword = await bcrypt.hash(tempPassword, saltRounds);

    // Actualizar usuario con contraseña temporal
    await prisma.user.update({
      where: { email },
      data: { password: hashedTempPassword }
    });

    // Enviar email con contraseña temporal
    await emailService.sendPasswordResetEmail(email, tempPassword);

    res.json({
      success: true,
      message: 'Si el email existe, recibirás las instrucciones para recuperar tu contraseña'
    });

  } catch (error) {
    console.error('Error en forgot password:', error);
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
});

// Actualizar perfil
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const updateData = updateProfileSchema.parse(req.body);

    // Obtener usuario actual para validación
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si el email está siendo cambiado a uno existente
    if (updateData.email && updateData.email !== currentUser.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: updateData.email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya existe' });
      }
    }

    // Manejar cambio de contraseña
    let hashedNewPassword: string | undefined;
    if (updateData.currentPassword && updateData.newPassword) {
      // Verificar contraseña actual
      const validPassword = await bcrypt.compare(updateData.currentPassword, currentUser.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
      }

      // Hashear nueva contraseña
      const saltRounds = 12;
      hashedNewPassword = await bcrypt.hash(updateData.newPassword, saltRounds);
    }

    // Preparar datos de actualización
    const dataToUpdate: any = {};
    if (updateData.email) dataToUpdate.email = updateData.email;
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.alias !== undefined) dataToUpdate.alias = updateData.alias;
    if (hashedNewPassword) dataToUpdate.password = hashedNewPassword;

    // Actualizar usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        alias: true,
        profilePhoto: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Error de validación', details: error.errors });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener perfil del usuario actual
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        alias: true,
        profilePhoto: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;

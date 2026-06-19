import axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { LLMServiceImproved } from './llmServiceImproved';
import { RecipeImportResponse } from '../types/recipe';

export interface CookidooAuth {
  username: string;
  password: string;
}

interface CookidooSession {
  jar: CookieJar;
  expires: Date;
}

// Endpoint del servicio de autenticación de Vorwerk (CIAM) al que apunta el form de login.
const CIAM_LOGIN_URL = 'https://ciam.prod.cookidoo.vorwerk-digital.com/login-srv/login';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

export class CookidooService {
  private llmService: LLMServiceImproved;
  private sessions: Map<string, CookidooSession> = new Map();

  constructor() {
    this.llmService = new LLMServiceImproved();
  }

  // Baja el HTML AUTENTICADO de una receta de Cookidoo (con la preparación completa)
  // y lo pasa al extractor LLM. Reutiliza la sesión si sigue válida.
  async extractRecipeWithAuth(url: string, auth: CookidooAuth): Promise<RecipeImportResponse> {
    console.log('\n🔐 COOKIDOO AUTHENTICATED EXTRACTION');
    console.log('📍 URL:', url);
    console.log('👤 Username:', auth.username);

    const html = await this.fetchAuthenticatedHtml(url, auth);
    console.log('🤖 Extracting recipe data from authenticated HTML...');
    return await this.llmService.extractRecipeFromHtml(html, url);
  }

  // Devuelve el HTML de la receta usando una sesión autenticada (login si hace falta).
  // Si el contenido vuelve sin autenticar, fuerza un re-login y reintenta una vez.
  // Devuelve el HTML autenticado de una URL de Cookidoo (sin extracción LLM).
  // Útil para releer datos puntuales (p.ej. nutrición) de recetas ya importadas.
  async getAuthenticatedHtml(url: string, auth: CookidooAuth): Promise<string> {
    return this.fetchAuthenticatedHtml(url, auth);
  }

  // Valida las credenciales haciendo solo el login (sin LLM ni extracción).
  async verifyLogin(auth: CookidooAuth): Promise<void> {
    const session = await this.login('https://cookidoo.international', auth);
    this.sessions.set(auth.username, session);
  }

  private async fetchAuthenticatedHtml(url: string, auth: CookidooAuth): Promise<string> {
    const origin = new URL(url).origin; // p.ej. https://cookidoo.international

    let session = this.sessions.get(auth.username);
    if (!session || session.expires <= new Date()) {
      session = await this.login(origin, auth);
      this.sessions.set(auth.username, session);
    }

    let html = await this.getWithJar(session.jar, url);

    // Si la sesión expiró del lado de Cookidoo, el HTML viene como no autenticado.
    if (this.looksUnauthenticated(html)) {
      console.log('⚠️ Contenido sin autenticar, renovando sesión...');
      session = await this.login(origin, auth);
      this.sessions.set(auth.username, session);
      html = await this.getWithJar(session.jar, url);
    }

    console.log('📏 HTML autenticado:', html.length, 'caracteres');
    return html;
  }

  // Flujo de login real (verificado): GET pág. de login (sigue redirects al CIAM y
  // captura cookies del flujo OAuth) → extrae requestId → POST credenciales → los
  // redirects de vuelta dejan las cookies de sesión (v-authenticated) en el jar.
  private async login(origin: string, auth: CookidooAuth): Promise<CookidooSession> {
    console.log('=== 🔐 COOKIDOO LOGIN START ===');
    const jar = new CookieJar();
    const client = this.makeClient(jar);

    // 1) Página de login (termina en eu.login.vorwerk.com/ciam/login?requestId=...)
    const loginPage = await client.get(`${origin}/profile/es/login`);
    const requestId = this.extractRequestId(loginPage.data);
    if (!requestId) {
      throw new Error('No se pudo iniciar el login de Cookidoo (requestId no encontrado). Es posible que Cookidoo haya cambiado su proceso de login.');
    }

    // 2) Enviar credenciales al CIAM. Los redirects posteriores fijan las cookies de sesión.
    const body = new URLSearchParams({
      requestId,
      username: auth.username,
      password: auth.password,
    });
    await client.post(CIAM_LOGIN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // 3) Verificar que quedó autenticado.
    const cookies = await jar.getCookies(origin);
    const authed = cookies.find(c => c.key === 'v-is-authenticated' && c.value === 'true')
      || cookies.find(c => c.key === 'v-authenticated' && !!c.value);
    if (!authed) {
      throw new Error('Login de Cookidoo fallido: credenciales inválidas o login modificado.');
    }

    console.log('✅ Login de Cookidoo exitoso');
    console.log('=== 🔐 COOKIDOO LOGIN END ===');
    return { jar, expires: new Date(Date.now() + 12 * 60 * 60 * 1000) }; // 12 h
  }

  private async getWithJar(jar: CookieJar, url: string): Promise<string> {
    const client = this.makeClient(jar);
    const res = await client.get(url);
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }

  private makeClient(jar: CookieJar): AxiosInstance {
    return wrapper(axios.create({
      jar,
      withCredentials: true,
      headers: BROWSER_HEADERS,
      maxRedirects: 12,
      timeout: 45000,
      // Aceptar 2xx/3xx; algunos pasos del flujo devuelven códigos no-2xx esperados.
      validateStatus: (status) => status < 400,
    }));
  }

  private extractRequestId(html: string): string | null {
    if (typeof html !== 'string') return null;
    const m = html.match(/name="requestId"\s+value="([^"]+)"/i)
      || html.match(/requestId["']?\s*[:=]\s*["']([0-9a-f-]{16,})["']/i);
    return m?.[1] || null;
  }

  private looksUnauthenticated(html: string): boolean {
    if (typeof html !== 'string') return true;
    // La receta pública no incluye recipeInstructions; la autenticada sí.
    return html.includes('is-unauthenticated') && !html.includes('recipeInstructions');
  }

  public cleanExpiredSessions(): void {
    const now = new Date();
    for (const [key, session] of this.sessions.entries()) {
      if (session.expires <= now) this.sessions.delete(key);
    }
  }
}

import path from 'path';
import fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer';
import { LLMServiceImproved } from './llmServiceImproved';
import { RecipeImportResponse } from '../types/recipe';

export interface FooditAuth {
  username: string;
  password: string;
}

// Foodit / La Nación esconde la preparación y los tips de las recetas detrás de un
// paywall por sesión (Auth0). A diferencia de Cookidoo (form HTML simple), el login
// de La Nación es una SPA con Auth0 + PKCE, imposible de reproducir de forma estable
// con un simple POST. Por eso usamos Puppeteer: abrimos un navegador headless, nos
// logueamos como lo haría una persona y leemos el HTML ya renderizado (igual que hace
// la extensión de Chrome, que sí trae el contenido completo).
//
// Usamos un userDataDir PERSISTENTE para que la sesión de Auth0 sobreviva entre
// importaciones (y reinicios): así no hace falta reloguear en cada receta.

const USER_DATA_DIR = path.join(__dirname, '../../.foodit-profile');
const DEBUG_DIR = path.join(__dirname, '../../.foodit-debug');
const LOGIN_START_URL = 'https://ingresar.lanacion.com.ar/';
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

export class FooditService {
  private llmService: LLMServiceImproved;
  private browser: Browser | null = null;
  private loggedInAt = 0;
  private loginInFlight: Promise<void> | null = null;

  constructor() {
    this.llmService = new LLMServiceImproved();
  }

  // Importa una receta de Foodit por URL usando una sesión autenticada.
  async extractRecipeWithAuth(url: string, auth: FooditAuth): Promise<RecipeImportResponse> {
    console.log('\n🔐 FOODIT AUTHENTICATED EXTRACTION');
    console.log('📍 URL:', url);
    console.log('👤 Username:', auth.username);

    const html = await this.fetchAuthenticatedHtml(url, auth);
    console.log('🤖 Extracting recipe data from authenticated HTML...');
    return await this.llmService.extractRecipeFromHtml(html, url);
  }

  // Devuelve el HTML autenticado de una URL de Foodit (sin extracción LLM).
  async getAuthenticatedHtml(url: string, auth: FooditAuth): Promise<string> {
    return this.fetchAuthenticatedHtml(url, auth);
  }

  // Valida las credenciales haciendo solo el login (sin extracción). Lanza si falla.
  async verifyLogin(auth: FooditAuth): Promise<void> {
    await this.ensureLoggedIn(auth, /* force */ true);
  }

  // Baja el HTML de la receta. Si el contenido vuelve sin la preparación (sesión
  // caída), fuerza un re-login y reintenta una vez.
  private async fetchAuthenticatedHtml(url: string, auth: FooditAuth): Promise<string> {
    await this.ensureLoggedIn(auth);

    let html = await this.loadRecipeHtml(url);
    if (this.looksUnauthenticated(html)) {
      console.log('⚠️ Contenido sin autenticar, renovando sesión de Foodit...');
      await this.ensureLoggedIn(auth, /* force */ true);
      html = await this.loadRecipeHtml(url);
    }

    console.log('📏 HTML de Foodit:', html.length, 'caracteres');
    return html;
  }

  // Navega a la receta en la sesión ya logueada y devuelve el DOM renderizado.
  private async loadRecipeHtml(url: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await this.preparePage(page);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      // Dar un margen para que la SPA pinte la preparación si el gating es client-side.
      await this.delay(1500);
      const html = await page.content();
      // DEBUG (temporal): guardar el HTML autenticado para inspeccionar la estructura
      // real de los pasos. Se puede quitar una vez ajustada la extracción.
      this.dumpHtml(url, html);
      return html;
    } finally {
      await page.close().catch(() => {});
    }
  }

  // Garantiza que el navegador tenga una sesión válida. Reusa la sesión si sigue
  // fresca; deduplica logins concurrentes con loginInFlight.
  private async ensureLoggedIn(auth: FooditAuth, force = false): Promise<void> {
    const fresh = Date.now() - this.loggedInAt < SESSION_TTL_MS;
    if (!force && fresh && this.browser) return;

    if (this.loginInFlight) return this.loginInFlight;

    this.loginInFlight = this.login(auth)
      .then(() => {
        this.loggedInAt = Date.now();
      })
      .finally(() => {
        this.loginInFlight = null;
      });

    return this.loginInFlight;
  }

  // Flujo de login real: abre la SPA de ingreso de La Nación, que redirige al
  // Universal Login de Auth0 (login.lanacion.com.ar); completa email + contraseña,
  // y los redirects posteriores dejan la sesión de La Nación en el perfil persistente.
  private async login(auth: FooditAuth): Promise<void> {
    console.log('=== 🔐 FOODIT LOGIN START ===');
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await this.preparePage(page);
      await page.goto(LOGIN_START_URL, { waitUntil: 'networkidle2', timeout: 60000 });

      // La Nación usa Auth0 Universal Login con flujo "identifier-first":
      //   1) pantalla de EMAIL → Continuar
      //   2) pantalla de CONTRASEÑA → Continuar
      // Ojo: la pantalla de email incluye un input[type=password] OCULTO, así que hay
      // que apuntar siempre al campo VISIBLE (no basta con que exista en el DOM).
      const userSel = 'input[name="username"], input#username, input[type="email"], input[name="email"]';
      const passSel = 'input[name="password"], input#password, input[type="password"]';

      // 1) Email (campo visible) → Continuar.
      const userEl = await page.waitForSelector(userSel, { visible: true, timeout: 30000 });
      await userEl!.type(auth.username, { delay: 30 });
      await this.clickSubmit(page);

      // 2) Contraseña (campo visible, ya en la 2da pantalla) → Continuar.
      const passEl = await page.waitForSelector(passSel, { visible: true, timeout: 30000 });
      await passEl!.type(auth.password, { delay: 30 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
        this.clickSubmit(page),
      ]);

      // 4) Posible pantalla de consentimiento de Auth0.
      await this.acceptConsentIfPresent(page);

      // 5) Verificar que la sesión quedó activa.
      await this.delay(1500);
      const stillOnAuth0 = /login\.lanacion\.com\.ar/i.test(page.url());
      const hasError = await page.$('.error-message, [class*="error"]');
      if (stillOnAuth0 || hasError) {
        const shot = await this.saveScreenshot(page, 'login-failed');
        throw new Error(
          `Login de Foodit fallido: credenciales inválidas o un paso extra (captcha/verificación). ` +
          `Revisá la captura: ${shot}`
        );
      }

      console.log('✅ Login de Foodit exitoso');
      console.log('=== 🔐 FOODIT LOGIN END ===');
    } catch (err) {
      await this.saveScreenshot(page, 'login-error').catch(() => {});
      throw err;
    } finally {
      await page.close().catch(() => {});
    }
  }

  // Hace clic en el botón de submit del form de Auth0 (varios selectores posibles).
  private async clickSubmit(page: Page): Promise<void> {
    const submitSel = 'button[name="action"][value="default"], button[type="submit"], button[name="action"]';
    const btn = await page.$(submitSel);
    if (btn) {
      await btn.click();
      return;
    }
    // Fallback: enviar el formulario con Enter desde la contraseña/email.
    await page.keyboard.press('Enter');
  }

  // Algunas configuraciones de Auth0 muestran una pantalla "Autorizar/Aceptar".
  private async acceptConsentIfPresent(page: Page): Promise<void> {
    if (!/login\.lanacion\.com\.ar/i.test(page.url())) return;
    const accept = await page.$('button[value="accept"], button#allow, button[name="action"][value="accept"]');
    if (accept) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        accept.click(),
      ]);
    }
  }

  // Heurística: la receta autenticada trae los pasos; la pública/paywall los oculta.
  private looksUnauthenticated(html: string): boolean {
    if (typeof html !== 'string') return true;
    const closed = /"content_code":"cerrada"/i.test(html);
    const emptyInstructions = /"recipeInstructions":\s*\[\s*\]/i.test(html);
    return closed || emptyInstructions;
  }

  private async preparePage(page: Page): Promise<void> {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1366, height: 900 });
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;

    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    this.browser = await puppeteer.launch({
      headless: true,
      userDataDir: USER_DATA_DIR,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--window-size=1366,900',
      ],
    });
    return this.browser;
  }

  // DEBUG (temporal): vuelca el HTML autenticado a .foodit-debug para inspección.
  private dumpHtml(url: string, html: string): void {
    try {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
      const slug = (url.split('/').filter(Boolean).pop() || 'recipe').replace(/[^a-z0-9-]/gi, '_').slice(0, 60);
      const file = path.join(DEBUG_DIR, `recipe-${slug}-${Date.now()}.html`);
      fs.writeFileSync(file, html);
      console.log('🧪 HTML autenticado guardado en:', file);
    } catch (e) {
      console.log('⚠️ No se pudo guardar el HTML de debug:', e instanceof Error ? e.message : e);
    }
  }

  private async saveScreenshot(page: Page, label: string): Promise<string> {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const file = path.join(DEBUG_DIR, `${label}-${Date.now()}.png`);
    await page.screenshot({ path: file as `${string}.png`, fullPage: true });
    console.log('📸 Captura de debug guardada en:', file);
    return file;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cierra el navegador (p.ej. al apagar el server).
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.loggedInAt = 0;
    }
  }
}

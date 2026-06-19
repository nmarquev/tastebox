// Popup script for TasteBox extension
let currentUser = null;
let isAuthenticated = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('TasteBox popup loaded');
  initializePopup();
  setupEventListeners();
});

// Initialize popup state
async function initializePopup() {
  showLoading(true);

  // Check auth status
  const authStatus = await checkAuthStatus();

  if (authStatus.isAuthenticated && authStatus.user) {
    isAuthenticated = true;
    currentUser = authStatus.user;
    showAuthenticatedView();
    // Show ready state, no auto-detection
    showReadyToImport();
  } else {
    isAuthenticated = false;
    currentUser = null;
    showNotAuthenticatedView();
  }

  // Load environment setting
  const result = await chrome.storage.local.get(['isDevelopment', 'customDevelopment']);
  const isDev = result.isDevelopment !== undefined ? result.isDevelopment : CONFIG.isDevelopment;

  // Set toggle state for both views (login and authenticated)
  const toggleAuth = document.getElementById('environment-toggle');
  const toggleLogin = document.getElementById('environment-toggle-login');
  if (toggleAuth) toggleAuth.checked = isDev;
  if (toggleLogin) toggleLogin.checked = isDev;

  CONFIG.isDevelopment = isDev;

  // Load custom development config if in development mode for both views
  if (result.customDevelopment) {
    CONFIG.setDevelopmentConfig(result.customDevelopment);

    // Authenticated view - only set if elements exist
    const apiUrl = document.getElementById('api-url');
    const apiPort = document.getElementById('api-port');
    const frontendUrl = document.getElementById('frontend-url');
    const frontendPort = document.getElementById('frontend-port');

    if (apiUrl) apiUrl.value = result.customDevelopment.apiUrl || CONFIG.defaultDevelopment.apiUrl;
    if (apiPort) apiPort.value = result.customDevelopment.apiPort || CONFIG.defaultDevelopment.apiPort;
    if (frontendUrl) frontendUrl.value = result.customDevelopment.frontendUrl || CONFIG.defaultDevelopment.frontendUrl;
    if (frontendPort) frontendPort.value = result.customDevelopment.frontendPort || CONFIG.defaultDevelopment.frontendPort;

    // Login view - only set if elements exist
    const apiUrlLogin = document.getElementById('api-url-login');
    const apiPortLogin = document.getElementById('api-port-login');
    const frontendUrlLogin = document.getElementById('frontend-url-login');
    const frontendPortLogin = document.getElementById('frontend-port-login');

    if (apiUrlLogin) apiUrlLogin.value = result.customDevelopment.apiUrl || CONFIG.defaultDevelopment.apiUrl;
    if (apiPortLogin) apiPortLogin.value = result.customDevelopment.apiPort || CONFIG.defaultDevelopment.apiPort;
    if (frontendUrlLogin) frontendUrlLogin.value = result.customDevelopment.frontendUrl || CONFIG.defaultDevelopment.frontendUrl;
    if (frontendPortLogin) frontendPortLogin.value = result.customDevelopment.frontendPort || CONFIG.defaultDevelopment.frontendPort;
  } else {
    // Set defaults for both views - only if elements exist
    const apiUrl = document.getElementById('api-url');
    const apiPort = document.getElementById('api-port');
    const frontendUrl = document.getElementById('frontend-url');
    const frontendPort = document.getElementById('frontend-port');

    if (apiUrl) apiUrl.value = CONFIG.defaultDevelopment.apiUrl;
    if (apiPort) apiPort.value = CONFIG.defaultDevelopment.apiPort;
    if (frontendUrl) frontendUrl.value = CONFIG.defaultDevelopment.frontendUrl;
    if (frontendPort) frontendPort.value = CONFIG.defaultDevelopment.frontendPort;

    const apiUrlLogin = document.getElementById('api-url-login');
    const apiPortLogin = document.getElementById('api-port-login');
    const frontendUrlLogin = document.getElementById('frontend-url-login');
    const frontendPortLogin = document.getElementById('frontend-port-login');

    if (apiUrlLogin) apiUrlLogin.value = CONFIG.defaultDevelopment.apiUrl;
    if (apiPortLogin) apiPortLogin.value = CONFIG.defaultDevelopment.apiPort;
    if (frontendUrlLogin) frontendUrlLogin.value = CONFIG.defaultDevelopment.frontendUrl;
    if (frontendPortLogin) frontendPortLogin.value = CONFIG.defaultDevelopment.frontendPort;
  }

  // Show/hide dev ports config based on environment for both views
  toggleDevPortsConfig(isDev);

  showLoading(false);
}

// Check authentication status
async function checkAuthStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkAuth' }, async (response) => {
      if (response && response.isAuthenticated) {
        // Get user data from storage
        const result = await chrome.storage.local.get(['user']);
        resolve({
          isAuthenticated: true,
          user: result.user
        });
      } else {
        resolve({
          isAuthenticated: false
        });
      }
    });
  });
}

// Show authenticated view
function showAuthenticatedView() {
  document.getElementById('not-authenticated').style.display = 'none';
  document.getElementById('authenticated').style.display = 'block';

  // Update user info
  if (currentUser) {
    const initials = getUserInitials(currentUser.name || currentUser.email);
    document.getElementById('user-initials').textContent = initials;
    document.getElementById('user-name').textContent = currentUser.name || 'Usuario';
    document.getElementById('user-email').textContent = currentUser.email;
  }
}

// Show ready to import state (no auto-detection)
function showReadyToImport() {
  const statusElement = document.getElementById('recipe-status');
  const importButton = document.getElementById('import-button');

  statusElement.className = 'recipe-status ready';
  document.getElementById('status-title').textContent = 'Listo para importar';
  document.getElementById('status-subtitle').textContent = 'Haz clic en el botón para importar esta página';
  importButton.disabled = false;
}

// Show not authenticated view
function showNotAuthenticatedView() {
  document.getElementById('not-authenticated').style.display = 'block';
  document.getElementById('authenticated').style.display = 'none';
}

// Get user initials
function getUserInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Setup event listeners
function setupEventListeners() {
  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Open app button
  document.getElementById('open-app-button')?.addEventListener('click', () => {
    chrome.tabs.create({ url: CONFIG.getFrontendUrl() });
  });

  // Logout button
  document.getElementById('logout-button')?.addEventListener('click', handleLogout);

  // Import button
  document.getElementById('import-button')?.addEventListener('click', handleImportClick);

  // View recipes button
  document.getElementById('view-recipes-button')?.addEventListener('click', () => {
    chrome.tabs.create({ url: CONFIG.getFrontendUrl() });
  });

  // Environment toggle (authenticated view)
  document.getElementById('environment-toggle')?.addEventListener('change', async (e) => {
    const isDev = e.target.checked;
    CONFIG.isDevelopment = isDev;
    await chrome.storage.local.set({ isDevelopment: isDev });
    toggleDevPortsConfig(isDev);
    console.log('Environment changed to:', isDev ? 'Development' : 'Production');
  });

  // Environment toggle (login view)
  document.getElementById('environment-toggle-login')?.addEventListener('change', async (e) => {
    const isDev = e.target.checked;
    CONFIG.isDevelopment = isDev;
    await chrome.storage.local.set({ isDevelopment: isDev });
    toggleDevPortsConfig(isDev);
    console.log('Environment changed to:', isDev ? 'Development' : 'Production');
  });

  // Save config button (authenticated view)
  document.getElementById('save-config-button')?.addEventListener('click', handleSaveConfig);

  // Save config button (login view)
  document.getElementById('save-config-button-login')?.addEventListener('click', handleSaveConfigLogin);
}

// Toggle dev ports configuration visibility
function toggleDevPortsConfig(show) {
  // Authenticated view
  const devPortsConfig = document.getElementById('dev-ports-config');
  if (devPortsConfig) {
    devPortsConfig.style.display = show ? 'block' : 'none';
  }

  // Login view
  const devPortsConfigLogin = document.getElementById('dev-ports-config-login');
  if (devPortsConfigLogin) {
    devPortsConfigLogin.style.display = show ? 'block' : 'none';
  }
}

// Handle save custom development config (authenticated view)
async function handleSaveConfig() {
  const apiUrl = document.getElementById('api-url').value || CONFIG.defaultDevelopment.apiUrl;
  const apiPort = parseInt(document.getElementById('api-port').value) || CONFIG.defaultDevelopment.apiPort;
  const frontendUrl = document.getElementById('frontend-url').value || CONFIG.defaultDevelopment.frontendUrl;
  const frontendPort = parseInt(document.getElementById('frontend-port').value) || CONFIG.defaultDevelopment.frontendPort;

  // Validate ports
  if (apiPort < 1000 || apiPort > 65535 || frontendPort < 1000 || frontendPort > 65535) {
    showNotification('Puertos inválidos. Deben estar entre 1000 y 65535', 'error');
    return;
  }

  // Validate URLs
  if (!apiUrl || !frontendUrl) {
    showNotification('Las URLs no pueden estar vacías', 'error');
    return;
  }

  // Save to storage
  const customDevelopment = { apiUrl, apiPort, frontendUrl, frontendPort };
  await chrome.storage.local.set({ customDevelopment });

  // Update CONFIG
  CONFIG.setDevelopmentConfig(customDevelopment);

  showNotification(`Configuración actualizada: ${apiUrl}:${apiPort}`, 'success');
  console.log('Custom development config saved:', customDevelopment);
}

// Handle save custom development config (login view)
async function handleSaveConfigLogin() {
  const apiUrl = document.getElementById('api-url-login').value || CONFIG.defaultDevelopment.apiUrl;
  const apiPort = parseInt(document.getElementById('api-port-login').value) || CONFIG.defaultDevelopment.apiPort;
  const frontendUrl = document.getElementById('frontend-url-login').value || CONFIG.defaultDevelopment.frontendUrl;
  const frontendPort = parseInt(document.getElementById('frontend-port-login').value) || CONFIG.defaultDevelopment.frontendPort;

  // Validate ports
  if (apiPort < 1000 || apiPort > 65535 || frontendPort < 1000 || frontendPort > 65535) {
    showNotification('Puertos inválidos. Deben estar entre 1000 y 65535', 'error');
    return;
  }

  // Validate URLs
  if (!apiUrl || !frontendUrl) {
    showNotification('Las URLs no pueden estar vacías', 'error');
    return;
  }

  // Save to storage
  const customDevelopment = { apiUrl, apiPort, frontendUrl, frontendPort };
  await chrome.storage.local.set({ customDevelopment });

  // Update CONFIG
  CONFIG.setDevelopmentConfig(customDevelopment);

  showNotification(`Configuración actualizada: ${apiUrl}:${apiPort}`, 'success');
  console.log('Custom development config saved:', customDevelopment);
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();
  showLoading(true);

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  chrome.runtime.sendMessage(
    {
      action: 'login',
      email,
      password
    },
    async (response) => {
      showLoading(false);

      if (response && response.success) {
        currentUser = response.user;
        isAuthenticated = true;
        showAuthenticatedView();
        // Show ready state, don't auto-detect
        showReadyToImport();
      } else {
        showNotification(
          response?.error || 'Error al iniciar sesión',
          'error'
        );
      }
    }
  );
}

// Handle logout
function handleLogout() {
  chrome.runtime.sendMessage({ action: 'logout' }, () => {
    isAuthenticated = false;
    currentUser = null;
    showNotAuthenticatedView();
  });
}

// Set recipe detection status
function setRecipeStatus(status, title, subtitle) {
  const statusElement = document.getElementById('recipe-status');
  statusElement.className = `recipe-status ${status}`;
  document.getElementById('status-title').textContent = title;
  document.getElementById('status-subtitle').textContent = subtitle;
}

// Handle import click
async function handleImportClick() {
  showLoading(true, 'Importando receta...');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    showLoading(false);
    showNotification('No se pudo acceder a la pestaña', 'error');
    return;
  }

  // Grab the fully-rendered DOM from the content script, then import.
  // Sending the rendered HTML lets the backend persist the recipe and extract
  // from JS-rendered / logged-in content (e.g. Cookidoo) instead of a bare URL fetch.
  chrome.tabs.sendMessage(tab.id, { action: 'detectRecipe' }, (pageData) => {
    const html = (!chrome.runtime.lastError && pageData) ? pageData.html : null;
    const renderedText = (!chrome.runtime.lastError && pageData) ? pageData.renderedText : '';
    const title = (!chrome.runtime.lastError && pageData?.metadata?.title) || tab.title || '';

    chrome.runtime.sendMessage(
      {
        action: 'importRecipe',
        url: tab.url,
        html,
        renderedText,
        title
      },
      (response) => {
      showLoading(false);

      if (response && response.success) {
        showNotification('¡Receta importada con éxito!', 'success');

        // Update status
        setRecipeStatus(
          'found',
          '¡Receta importada!',
          'La receta se guardó en tu colección'
        );

        // Disable import button temporarily
        document.getElementById('import-button').disabled = true;

        // Re-enable after 2 seconds in case user wants to import again
        setTimeout(() => {
          showReadyToImport();
        }, 2000);
      } else {
        showNotification(
          response?.error || 'No se encontró una receta en esta página',
          'error'
        );

        // Show error state
        setRecipeStatus(
          'not-found',
          'No se encontró receta',
          response?.error || 'Esta página no contiene una receta válida'
        );
      }
      }
    );
  });
}

// Show/hide loading overlay
function showLoading(show, text = 'Cargando...') {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = overlay.querySelector('.loading-text');

  if (loadingText) {
    loadingText.textContent = text;
  }

  overlay.style.display = show ? 'flex' : 'none';
}

// Show notification (inline in popup)
function showNotification(message, type = 'info') {
  // Create temporary notification element
  const notification = document.createElement('div');
  notification.className = `popup-notification popup-notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Fade in
  setTimeout(() => notification.classList.add('show'), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add notification styles dynamically
const style = document.createElement('style');
style.textContent = `
  .popup-notification {
    position: fixed;
    top: 70px;
    left: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    z-index: 1001;
  }
  .popup-notification.show {
    opacity: 1;
    transform: translateY(0);
  }
  .popup-notification-success {
    background: #D1FAE5;
    color: #065F46;
    border: 1px solid #10B981;
  }
  .popup-notification-error {
    background: #FEE2E2;
    color: #991B1B;
    border: 1px solid #EF4444;
  }
  .popup-notification-info {
    background: #DBEAFE;
    color: #1E40AF;
    border: 1px solid #3B82F6;
  }
`;
document.head.appendChild(style);

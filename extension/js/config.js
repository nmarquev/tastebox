// Configuration for TasteBox API
const CONFIG = {
  // Development mode - set to false for production
  isDevelopment: true,

  // Default configuration for development
  defaultDevelopment: {
    apiUrl: 'http://localhost',
    apiPort: 3005,
    frontendUrl: 'http://localhost',
    frontendPort: 8080
  },

  // Custom development config (loaded from storage)
  customDevelopment: null,

  // API URLs
  development: {
    apiUrl: 'http://localhost:3005',
    frontendUrl: 'http://localhost:8080'
  },

  production: {
    apiUrl: 'https://tastebox.beweb.com.ar',
    frontendUrl: 'https://tastebox.beweb.com.ar'
  },

  // Set custom development configuration
  setDevelopmentConfig(config) {
    this.customDevelopment = config;
    const apiUrl = config.apiUrl || this.defaultDevelopment.apiUrl;
    const apiPort = config.apiPort || this.defaultDevelopment.apiPort;
    const frontendUrl = config.frontendUrl || this.defaultDevelopment.frontendUrl;
    const frontendPort = config.frontendPort || this.defaultDevelopment.frontendPort;

    this.development.apiUrl = `${apiUrl}:${apiPort}`;
    this.development.frontendUrl = `${frontendUrl}:${frontendPort}`;
  },

  // Backward compatibility - set custom development ports
  setDevelopmentPorts(backendPort, frontendPort) {
    this.setDevelopmentConfig({
      apiUrl: this.defaultDevelopment.apiUrl,
      apiPort: backendPort,
      frontendUrl: this.defaultDevelopment.frontendUrl,
      frontendPort: frontendPort
    });
  },

  // Get current API URL based on environment
  getApiUrl() {
    return this.isDevelopment ? this.development.apiUrl : this.production.apiUrl;
  },

  // Get current frontend URL based on environment
  getFrontendUrl() {
    return this.isDevelopment ? this.development.frontendUrl : this.production.frontendUrl;
  },

  // API endpoints
  endpoints: {
    health: '/api/health',
    auth: '/api/auth',
    login: '/api/auth/login',
    register: '/api/auth/register',
    me: '/api/auth/me',
    importHtml: '/api/import-html',
    recipes: '/api/recipes'
  },

  // Get full endpoint URL
  getEndpoint(endpoint) {
    return this.getApiUrl() + (this.endpoints[endpoint] || endpoint);
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
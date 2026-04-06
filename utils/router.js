/**
 * Router SPA basado en hash
 */
import Store from '../utils/store.js';

const routes = {};
let currentRoute = null;

export const Router = {
  /**
   * Registra una ruta
   * @param {string} path - ruta hash
   * @param {Function} handler - función que renderiza la vista
   * @param {Array} roles - roles permitidos (vacío = todos)
   */
  register(path, handler, roles = []) {
    routes[path] = { handler, roles };
  },

  navigate(path) {
    window.location.hash = path;
  },

  init() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  },

  _resolve() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, queryStr] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryStr || ''));

    // Match de ruta (soporte param :id)
    let route = null;
    let params = {};

    for (const [pattern, config] of Object.entries(routes)) {
      const match = matchPath(pattern, path);
      if (match) {
        route = config;
        params = match;
        break;
      }
    }

    if (!route) {
      this.navigate('/dashboard');
      return;
    }

    // Verificar auth
    const user = Store.get('user');
    if (!user && path !== '/login') {
      this.navigate('/login');
      return;
    }

    // Verificar roles
    if (route.roles.length > 0 && user && !route.roles.includes(user.role)) {
      renderUnauthorized();
      return;
    }

    currentRoute = path;
    route.handler({ params, query });
  },

  getCurrentRoute() {
    return currentRoute;
  },
};

function matchPath(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function renderUnauthorized() {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:.75rem;text-align:center">
      <div style="font-size:3rem;opacity:.5">🔒</div>
      <p style="color:#94a3b8;margin:0">No tienes acceso a esta sección.</p>
      <button class="btn btn-ghost btn-sm" onclick="history.back()">← Volver</button>
    </div>
  `;
}

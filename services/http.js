/**
 * Cliente HTTP centralizado para Florería API
 * Maneja JWT, refresh automático, y errores globales
 */

const BASE_URL = 'https://system-enterprise.onrender.com/api/v1';

let isRefreshing = false;
let refreshQueue = [];

/**
 * Procesa la cola de peticiones pendientes durante el refresh
 */
function processQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

/**
 * Realiza el refresh del token de acceso
 */
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Refresh failed');

  localStorage.setItem('accessToken', data.data.accessToken);
  return data.data.accessToken;
}

/**
 * Cliente HTTP principal con manejo automático de auth
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem('accessToken');
  console.log(`[AUTH] ${options.method || 'GET'} ${endpoint} | token: ${token ? 'OK (' + token.slice(-10) + ')' : 'NULL'}`);

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = { ...options, headers };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    let response = await fetch(url, config);

    // Token expirado → intentar refresh
    if (response.status === 401) {
      if (isRefreshing) {
        // Encolar petición mientras se refresca
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          config.headers.Authorization = `Bearer ${newToken}`;
          return fetch(url, config).then(parseResponse);
        });
      }

      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(null, newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(url, config);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);
        // Sesión expirada → redirigir al login
        localStorage.clear();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
      }
    }

    return parseResponse(response);
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('No se puede conectar al servidor. Verifica que esté activo.');
    }
    throw error;
  }
}

async function parseResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Respuesta inválida del servidor');
  }

  if (!response.ok) {
    const message = data?.message || data?.error?.message || `Error ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    if (response.status === 429) {
      err.message = 'Demasiadas peticiones. Espera un momento e intenta de nuevo.';
    }
    throw err;
  }

  return data;
}

// Métodos de conveniencia
const http = {
  get: (endpoint, params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    ).toString();
    return request(`${endpoint}${query ? `?${query}` : ''}`);
  },
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

export default http;

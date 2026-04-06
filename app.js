/**
 * ════════════════════════════════════════════
 *  FLORERÍA ADMIN — app.js
 *  Punto de entrada principal
 * ════════════════════════════════════════════
 */

import { Router } from './utils/router.js';
import Store from './utils/store.js';
import { AuthController } from './controllers/auth.controller.js';
import { AlertService, CashboxService } from './services/api.js';
import { Toast } from './components/ui.js';
import { getRoleLabel, getInitials, formatDate } from './utils/helpers.js';

// ─── VIEWS ─────────────────────────────────────────────────
import { renderLogin } from './views/login.view.js';
import { renderDashboard } from './views/dashboard.view.js';
import { renderPOS } from './views/pos.view.js';
import { renderProducts } from './views/products.view.js';
import { renderInventory } from './views/inventory.view.js';
import { renderCashbox } from './views/cashbox.view.js';
import { renderSales } from './views/sales.view.js';
import { renderFinances } from './views/finances.view.js';
import { renderReports } from './views/reports.view.js';
import {
  renderAlerts, renderAudit,
  renderEmployees, renderCategories, renderRecipes,
} from './views/modules.view.js';

// ════════════════════════════════════════════
//  INICIALIZACIÓN
// ════════════════════════════════════════════

// Variables para evitar ejecutores concurrentes
let _isLoadingCashbox = false;
let _isLoadingAlerts = false;

async function init() {
  // Escuchar logout global (token expirado)
  window.addEventListener('auth:logout', () => {
    renderLogin();
  });

  // Verificar sesión existente
  const loggedIn = await AuthController.verifySession();

  if (!loggedIn) {
    renderLogin();
    return;
  }

  // Sesión válida → mostrar app
  await bootApp();
}

async function bootApp() {
  // Mostrar shell
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  // Renderizar info de usuario en sidebar
  renderUserInfo();

  // Setup sidebar y topbar
  setupSidebar();
  setupTopbar();

  // Registrar rutas
  registerRoutes();

  // Cargar estado global inicial
  await Promise.allSettled([
    loadCashboxState(),
    loadAlertCount(),
  ]);

  // Iniciar Router
  Router.init();

  // Reloj en topbar
  startClock();

  // Polling de alertas cada 5 min
  setInterval(loadAlertCount, 300000);

  // Polling de cashbox cada 2 min
  setInterval(loadCashboxState, 120000);

  // Verificar salud del servidor cada 5 min
  checkHealth();
  setInterval(checkHealth, 300000);
}

// ════════════════════════════════════════════
//  RUTAS
// ════════════════════════════════════════════
function registerRoutes() {
  const nav = (route, view) => () => { setActiveNav(route); view(); };

  Router.register('/login', () => renderLogin());
  Router.register('/dashboard', nav('/dashboard', renderDashboard));
  Router.register('/pos',       nav('/pos', renderPOS),       ['admin','manager','employee','cashier']);
  Router.register('/cashbox',   nav('/cashbox', renderCashbox), ['admin','manager','employee','cashier']);
  Router.register('/products',  nav('/products', renderProducts), ['admin','manager','warehouse']);
  Router.register('/categories',nav('/categories', renderCategories), ['admin','manager']);
  Router.register('/recipes',   nav('/recipes', renderRecipes), ['admin','manager']);
  Router.register('/inventory', nav('/inventory', renderInventory), ['admin','manager','warehouse']);
  Router.register('/sales',     nav('/sales', renderSales), ['admin','manager','employee']);
  Router.register('/finances',  nav('/finances', renderFinances), ['admin','manager']);
  Router.register('/employees', nav('/employees', renderEmployees), ['admin']);
  Router.register('/reports',   nav('/reports', renderReports), ['admin','manager']);
  Router.register('/alerts',    nav('/alerts', renderAlerts));
  Router.register('/audit',     nav('/audit', renderAudit), ['admin']);
}

// ════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════
function setupSidebar() {
  // Sidebar collapse (compatibilidad)
  const collapseBtn = document.getElementById('sidebar-collapse');
  if (collapseBtn) collapseBtn.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  // Botón menú móvil — usa overlay del estilo prubagoty
  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show');
  });

  // Overlay cierra sidebar
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    overlay.classList.remove('show');
  });

  // Click en contenido cierra sidebar móvil
  document.getElementById('main-content').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open', 'mobile-open');
    if (ov) ov.classList.remove('show');
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await AuthController.logout();
    renderLogin();
  });

  // Ocultar/mostrar nav items según rol
  applyRoleVisibility();
}

function applyRoleVisibility() {
  const user = Store.get('user');
  if (!user) return;
  const role = user.role;

  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.dataset.roles.split(',').map(r => r.trim());
    el.style.display = allowed.includes(role) ? '' : 'none';
  });
}

// ════════════════════════════════════════════
//  TOPBAR
// ════════════════════════════════════════════
function setupTopbar() {
  // Botón de refresh de alertas
  document.getElementById('refresh-alerts-btn').addEventListener('click', async () => {
    await loadAlertCount();
    Toast.info('Alertas actualizadas');
  });
}

function startClock() {
  const el = document.getElementById('topbar-time');
  function tick() {
    el.textContent = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

// ════════════════════════════════════════════
//  ESTADO GLOBAL
// ════════════════════════════════════════════
function renderUserInfo() {
  const user = Store.get('user');
  if (!user) return;
  const initials = getInitials(user.first_name, user.last_name);
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent = `${user.first_name} ${user.last_name}`;
  document.getElementById('user-role').textContent = getRoleLabel(user.role);
}

async function loadCashboxState() {
  // Evitar ejecución concurrente
  if (_isLoadingCashbox) return;
  _isLoadingCashbox = true;
  
  try {
    const res = await CashboxService.getStatus();
    const data = res.data;
    const session = data?.session;
    const dot = document.getElementById('cashbox-dot');
    const text = document.getElementById('cashbox-status-text');

    if (session && data.status === 'open') {
      Store.set('cashbox', session);
      if (dot) dot.style.background = 'var(--verde-500)'; dot.className = 'cashbox-dot';
      if (text) text.textContent = `Caja #${session.id} abierta`;
    } else {
      Store.set('cashbox', null);
      if (dot) dot.style.background = 'var(--danger)'; dot.className = 'cashbox-dot';
      if (text) text.textContent = 'Sin caja activa';
    }
  } catch {
    const dot = document.getElementById('cashbox-dot');
    if (dot) dot.className = 'cashbox-dot';
  } finally {
    _isLoadingCashbox = false;
  }
}

async function loadAlertCount() {
  // Evitar ejecución concurrente
  if (_isLoadingAlerts) return;
  _isLoadingAlerts = true;
  
  try {
    const res = await AlertService.getUnreadCount();
    const count = res.data?.count || 0;
    Store.set('unreadAlerts', count);

    const badge1 = document.getElementById('nav-alert-badge');
    const badge2 = document.getElementById('topbar-alert-count');

    if (badge1) {
      badge1.textContent = count;
      badge1.style.display = count > 0 ? '' : 'none';
    }
    if (badge2) {
      badge2.textContent = count;
      badge2.style.display = count > 0 ? '' : 'none';
    }
  } catch {} finally {
    _isLoadingAlerts = false;
  }
}

async function checkHealth() {
  const dot = document.getElementById('health-dot');
  if (!dot) return;
  const C = { ok: 'var(--verde-500)', error: 'var(--danger)' };
  try {
    const res = await fetch('https://system-enterprise.onrender.com/health');
    if (res.ok) {
      dot.style.color = C.ok; dot.title = 'Servidor activo';
    } else {
      dot.style.color = C.error; dot.title = 'Error en servidor';
    }
  } catch {
    dot.style.color = C.error; dot.title = 'Servidor no disponible';
  }
}

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════
function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });
  // Actualizar título topbar estilo prubagoty
  const labels = {
    '/dashboard':'Dashboard','/pos':'Punto de Venta','/cashbox':'Caja',
    '/products':'Productos','/categories':'Categorías','/recipes':'Recetas',
    '/inventory':'Inventario','/sales':'Ventas','/finances':'Finanzas',
    '/employees':'Empleados','/reports':'Reportes','/alerts':'Alertas','/audit':'Auditoría'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl && labels[route]) titleEl.textContent = labels[route];
}

// ════════════════════════════════════════════
//  ARRANQUE
// ════════════════════════════════════════════
init().catch(console.error);

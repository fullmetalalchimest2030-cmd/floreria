/* =============================================
   ENCANTOS ETERNOS — Admin Layout JS
   Sidebar, topbar, navegación, logout
   ============================================= */

const NAV_ITEMS = [
  { section: 'Principal' },
  { href: 'dashboard.html',   icon: '◈', label: 'Dashboard',     badge: null },

  { section: 'Operaciones' },
  { href: 'ventas.html',      icon: '◎', label: 'Ventas',        badge: null },
  { href: 'pedidos.html',     icon: '◻', label: 'Pedidos',       badge: 'pendientes' },
  { href: 'caja.html',        icon: '◆', label: 'Caja del día',  badge: null },

  { section: 'Catálogo' },
  { href: 'productos.html',   icon: '❋', label: 'Productos',     badge: null },
  { href: 'inventario.html',  icon: '◉', label: 'Inventario',    badge: 'stock_bajo' },
  { href: 'laboratorio.html', icon: '✦', label: 'Laboratorio',   badge: null },

  { section: 'Negocio' },
  { href: 'clientes.html',    icon: '◯', label: 'Clientes',      badge: null },
  { href: 'trabajadores.html',icon: '◐', label: 'Trabajadores',  badge: null },
  { href: 'gastos.html',      icon: '▣', label: 'Gastos',        badge: null },
  { href: 'reportes.html',    icon: '▦', label: 'Reportes',      badge: null },

  { section: 'Contenido' },
  { href: 'promociones.html', icon: '★', label: 'Promociones',   badge: null },
  { href: 'eventos.html',     icon: '◇', label: 'Eventos',       badge: null },
];

function renderSidebar(activePage) {
  const user = JSON.parse(localStorage.getItem('ee_user') || '{}');
  const initials = (user.nombre || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  let html = `
    <div class="sidebar-brand">
      <div class="brand-name">Detalles y Regalos<br>Encantos Eternos</div>
      <div class="brand-sub">Panel de gestión</div>
    </div>
    <div class="sidebar-user">
      <div class="avatar">${initials}</div>
      <div class="sidebar-user-info">
        <div class="name">${user.nombre || 'Usuario'}</div>
        <div class="role">${getRoleLabel(user.rol)}</div>
      </div>
    </div>
    <nav class="sidebar-nav">`;

  let currentSection = null;
  let sectionItems = [];

  NAV_ITEMS.forEach((item, index) => {
    if (item.section) {
      // Renderizar sección anterior si tiene items
      if (currentSection && sectionItems.length > 0) {
        html += `<div class="nav-section-label">${currentSection}</div>`;
        html += sectionItems.join('');
      }
      // Iniciar nueva sección
      currentSection = item.section;
      sectionItems = [];
    } else {
      // Verificar permisos
      if (!canAccess(item.href, user.rol)) return;
      
      const isActive = activePage && item.href.includes(activePage);
      const badgeHtml = item.badge ? `<span class="nav-badge" id="badge-${item.badge}">0</span>` : '';
      sectionItems.push(`
        <a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">
          <span class="nav-icon">${item.icon}</span>
          ${item.label}
          ${badgeHtml}
        </a>`);
    }
    
    // Renderizar última sección
    if (index === NAV_ITEMS.length - 1 && sectionItems.length > 0) {
      html += `<div class="nav-section-label">${currentSection}</div>`;
      html += sectionItems.join('');
    }
  });

  html += `
    </nav>
    <div class="sidebar-footer">
      <button class="btn-home" onclick="window.location.href='../../index.html'" style="width:100%;padding:10px 16px;margin-bottom:8px;background:var(--gris-700);border:none;border-radius:6px;color:white;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background 0.2s;font-weight:500">
        <span>🏠</span> Ir a inicio
      </button>
      <button class="btn-logout" onclick="handleLogout()">
        <span>↩</span> Cerrar sesión
      </button>
    </div>`;

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.innerHTML = html;

  // Cargar badges dinámicos
  loadBadges();
}

function getRoleLabel(rol) {
  const labels = { admin: 'Administrador', empleado: 'Empleado', duena: 'Dueña' };
  return labels[rol] || rol;
}

function canAccess(href, rol) {
  // Admin tiene acceso a todo
  if (rol === 'admin') return true;
  
  // Empleado: Solo operaciones diarias
  if (rol === 'empleado') {
    const empleadoAllowed = [
      'ventas.html',
      'pedidos.html',
      'caja.html',
      'productos.html',    // Solo lectura (para ver catálogo en ventas)
      'laboratorio.html',  // Puede crear arreglos
      'clientes.html'      // Solo lectura (para buscar en ventas)
    ];
    return empleadoAllowed.some(p => href.includes(p));
  }
  
  // Dueña: Reportes, gastos, contenido
  if (rol === 'duena') {
    const duenaAllowed = [
      'dashboard.html',
      'productos.html',    // Solo lectura
      'inventario.html',   // Puede ver inventario (supervisión)
      'laboratorio.html',  // Solo lectura
      'clientes.html',
      'gastos.html',
      'reportes.html',
      'promociones.html',
      'eventos.html'
    ];
    return duenaAllowed.some(p => href.includes(p));
  }
  
  return false;
}

async function loadBadges() {
  try {
    const token = localStorage.getItem('ee_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    // Pedidos pendientes
    const rp = await fetch('http://localhost:3000/api/pedidos?estado=pendiente', { headers });
    const dp = await rp.json();
    const badgePend = document.getElementById('badge-pendientes');
    if (badgePend) {
      const count = dp.total || 0;
      badgePend.textContent = count;
      badgePend.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    // Inventario bajo
    const ri = await fetch('http://localhost:3000/api/inventario?stock_bajo=true', { headers });
    const di = await ri.json();
    const badgeInv = document.getElementById('badge-stock_bajo');
    if (badgeInv) {
      const count = di.total || 0;
      badgeInv.textContent = count;
      badgeInv.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  } catch { /* offline ok */ }
}

function renderTopbar(title, breadcrumb = '') {
  const topbar = document.getElementById('topbar');
  if (!topbar) return;
  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="btn-hamburger" onclick="toggleSidebar()" id="btn-hamburger">☰</button>
      <div>
        <div class="page-title">${title}</div>
        ${breadcrumb ? `<div class="page-breadcrumb">${breadcrumb}</div>` : ''}
      </div>
    </div>
    <div class="topbar-right">
      <span style="font-size:12px;color:var(--gris-500)">${new Date().toLocaleDateString('es-PE', {weekday:'long', day:'2-digit', month:'long'})}</span>
      <button class="btn-dark-toggle" onclick="toggleDark()" title="Modo oscuro" aria-label="Cambiar tema">🌙</button>
    </div>`;
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb?.classList.toggle('open');
  ov?.classList.toggle('show');
}

function handleLogout() {
  if (confirm('¿Seguro que deseas cerrar sesión?')) {
    localStorage.removeItem('ee_token');
    localStorage.removeItem('ee_user');
    window.location.href = 'login.html';
  }
}

// Proteger páginas del admin
function requireAuth() {
  const token = localStorage.getItem('ee_token');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Verificar permisos para la página actual
function checkPageAccess(pageName) {
  const user = JSON.parse(localStorage.getItem('ee_user') || '{}');
  const currentPage = pageName + '.html';
  
  if (!canAccess(currentPage, user.rol)) {
    console.warn(`Usuario ${user.rol} no tiene acceso a ${pageName}`);
    Toast.error('No tienes permisos para acceder a esta página');
    setTimeout(() => {
      // Redirigir según rol
      if (user.rol === 'empleado') {
        window.location.href = 'ventas.html';
      } else if (user.rol === 'duena') {
        window.location.href = 'dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 1500);
    return false;
  }
  return true;
}

// Inicializar layout completo
function initAdminLayout(activePage, pageTitle, breadcrumb) {
  if (!requireAuth()) return;
  
  // Verificar permisos de acceso a la página
  if (!checkPageAccess(activePage)) return;
  
  renderSidebar(activePage);
  renderTopbar(pageTitle, breadcrumb);

  // Overlay para cerrar sidebar en mobile
  const ov = document.getElementById('sidebar-overlay');
  if (ov) ov.addEventListener('click', toggleSidebar);
}

/**
 * Módulos: Alertas, Auditoría, Empleados, Categorías, Recetas
 */
// ─── IMPORTS CONSOLIDADOS ────────────────────────────────────────────────────
import { AlertService, AuditService, EmployeeService, CategoryService, RecipeService, ProductService } from '../services/api.js';
import { formatDate, formatCurrency, getRoleLabel, severityClass } from '../utils/helpers.js';
import { Toast, showLoading, showError, confirm, buildTable, showModal, closeModal } from '../components/ui.js';
import { buildForm, attachFormHandlers } from '../components/form.js';
import Store from '../utils/store.js';

/**
 * Vista Alertas
 */

export async function renderAlerts() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">🔔 Alertas</h1><p class="page-subtitle">Notificaciones del sistema</p></div>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-ghost btn-sm" onclick="window._alertsMarkAll()">✓ Marcar todas leídas</button>
        <button class="btn btn-warning btn-sm" onclick="window._alertsCheckStock()">⚠️ Verificar Stock</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="all" onclick="window._alertsTab('all')">Todas</button>
      <button class="tab-btn" data-tab="critical" onclick="window._alertsTab('critical')">🔴 Críticas</button>
      <button class="tab-btn" data-tab="unread" onclick="window._alertsTab('unread')">Sin Leer</button>
    </div>
    <div id="alerts-content"></div>
  `;
  window._alertsTab = (t) => loadAlerts(t);
  window._alertsMarkAll = markAllRead;
  window._alertsCheckStock = checkLowStock;
  window._alertRead = (id) => markRead(id);
  window._alertResolve = (id) => resolveAlert(id);
  window._alertDelete = (id) => deleteAlert(id);
  await loadAlerts('all');
}

async function loadAlerts(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const content = document.getElementById('alerts-content');
  showLoading(content);
  try {
    let data;
    if (tab === 'critical') {
      const res = await AlertService.getCritical({ limit: 50 });
      data = res.data || [];
    } else {
      const res = await AlertService.getAll();
      data = res.data || [];
      if (tab === 'unread') data = data.filter(a => !a.is_read);
    }

    if (!data.length) {
      content.innerHTML = `<div class="empty-state" style="padding:3rem"><div style="font-size:3rem">${tab === 'critical' ? '✅' : '🔔'}</div><p>${tab === 'critical' ? 'Sin alertas críticas' : 'Sin alertas'}</p></div>`;
      return;
    }

    const severityIcon = { critical: '🔴', warning: '🟡', info: 'ℹ️', success: '✅' };
    content.innerHTML = `<div style="display:flex;flex-direction:column;gap:.625rem">
      ${data.map(alert => `
        <div class="alert-item ${!alert.is_read ? 'unread' : ''} ${alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : ''}">
          <div class="alert-icon">${severityIcon[alert.severity] || 'ℹ️'}</div>
          <div class="alert-body">
            <div class="alert-title">${alert.title || alert.type}</div>
            <div class="alert-msg">${alert.message}</div>
            <div class="alert-time">${formatDate(alert.created_at)}</div>
          </div>
          <div class="alert-actions">
            ${!alert.is_read ? `<button class="btn btn-ghost btn-sm btn-icon" onclick="window._alertRead(${alert.id})" title="Marcar leída">✓</button>` : ''}
            ${!alert.is_resolved ? `<button class="btn btn-success btn-sm btn-icon" onclick="window._alertResolve(${alert.id})" title="Resolver">🔧</button>` : ''}
            <button class="btn btn-danger btn-sm btn-icon" onclick="window._alertDelete(${alert.id})" title="Eliminar">🗑</button>
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (err) { showError(content, err.message); }
}

async function markRead(id) {
  try { await AlertService.markRead(id); await loadAlerts('all'); updateAlertBadge(); } catch (err) { Toast.error(err.message); }
}

async function resolveAlert(id) {
  try { await AlertService.resolve(id); Toast.success('Alerta resuelta'); await loadAlerts('all'); } catch (err) { Toast.error(err.message); }
}

async function deleteAlert(id) {
  if (!(await confirm('¿Eliminar esta alerta?'))) return;
  try { await AlertService.delete(id); await loadAlerts('all'); } catch (err) { Toast.error(err.message); }
}

async function markAllRead() {
  try { const res = await AlertService.markAllRead(); Toast.success(`${res.data.updated} alertas marcadas como leídas`); await loadAlerts('all'); updateAlertBadge(); } catch (err) { Toast.error(err.message); }
}

async function checkLowStock() {
  try { const res = await AlertService.checkLowStock(); Toast.success(`${res.data.alerts_created} alertas creadas`); await loadAlerts('all'); } catch (err) { Toast.error(err.message); }
}

async function updateAlertBadge() {
  try {
    const res = await AlertService.getUnreadCount();
    const count = res.data.count || 0;
    Store.set('unreadAlerts', count);
    const badge1 = document.getElementById('nav-alert-badge');
    const badge2 = document.getElementById('topbar-alert-count');
    if (badge1) { badge1.textContent = count; badge1.style.display = count > 0 ? '' : 'none'; }
    if (badge2) { badge2.textContent = count; badge2.style.display = count > 0 ? '' : 'none'; }
  } catch {}
}


/**
 * Vista Auditoría
 */
export async function renderAudit() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">🔍 Auditoría</h1><p class="page-subtitle">Registro de acciones del sistema</p></div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="logs" onclick="window._auditTab('logs')">📋 Logs</button>
      <button class="tab-btn" data-tab="stats" onclick="window._auditTab('stats')">📊 Estadísticas</button>
    </div>
    <div id="audit-content"></div>
  `;
  window._auditTab = (t) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    if (t === 'logs') loadAuditLogs();
    else loadAuditStats();
  };
  loadAuditLogs();
}

async function loadAuditLogs() {
  const content = document.getElementById('audit-content');
  content.innerHTML = `
    <div class="filter-bar">
      <div class="form-group">
        <label class="form-label">Acción</label>
        <select class="form-input" id="audit-filter-action" onchange="window._loadAuditData()">
          <option value="">Todas</option>
          <option value="create">Creación general</option>
          <option value="read">Lectura/consulta</option>
          <option value="update">Actualización general</option>
          <option value="delete">Eliminación general</option>
          <option value="login">Inicio de sesión</option>
          <option value="logout">Cierre de sesión</option>
          <option value="sale_created">Venta creada</option>
          <option value="sale_completed">Venta completada</option>
          <option value="sale_cancelled">Venta cancelada</option>
          <option value="inventory_in">Entrada de inventario</option>
          <option value="inventory_out">Salida de inventario</option>
          <option value="inventory_adjustment">Ajuste de inventario</option>
          <option value="cashbox_open">Apertura de caja</option>
          <option value="cashbox_close">Cierre de caja</option>
          <option value="cashbox_adjustment">Ajuste de caja</option>
          <option value="expense_created">Gasto creado</option>
          <option value="expense_updated">Gasto actualizado</option>
          <option value="expense_deleted">Gasto eliminado</option>
          <option value="alert_created">Alerta creada</option>
          <option value="alert_resolved">Alerta resuelta</option>
          <option value="user_created">Usuario creado</option>
          <option value="user_updated">Usuario actualizado</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tabla/Módulo</label>
        <input type="text" class="form-input" id="audit-filter-table" placeholder="products, sales..." onchange="window._loadAuditData()">
      </div>
      <div class="form-group">
        <label class="form-label">Desde</label>
        <input type="date" class="form-input" id="audit-filter-from" onchange="window._loadAuditData()">
      </div>
    </div>
    <div class="card" style="padding:0">
      <div id="audit-table-container"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;
  window._loadAuditData = loadAuditData;
  await loadAuditData();
}

async function loadAuditData() {
  const container = document.getElementById('audit-table-container');
  if (!container) {
    console.error('[DEBUG Audit] Container #audit-table-container not found!');
    return;
  }
  
  // Limpiar cualquier contenido previo (incluyendo spinners anteriores)
  container.innerHTML = '';
  
  console.log('[DEBUG Audit] loadAuditData called, container:', container);
  showLoading(container);
  console.log('[DEBUG Audit] Loading shown');

  try {
    const params = {};
    const a = document.getElementById('audit-filter-action')?.value;
    const t = document.getElementById('audit-filter-table')?.value;
    const f = document.getElementById('audit-filter-from')?.value;
    if (a) params.action = a;
    if (t) params.table_name = t;
    if (f) params.start_date = f;
    
    console.log('[DEBUG Audit] Request params:', params);
    console.log('[DEBUG Audit] Calling AuditService.getAll...');
    const res = await AuditService.getAll({ ...params, limit: 100 });
    console.log('[DEBUG Audit] Response received:', res);
    
    // Handle both array and object responses
    let data;
    if (Array.isArray(res.data)) {
      data = res.data;
    } else if (res.data && typeof res.data === 'object') {
      data = res.data.audit || res.data.logs || res.data.items || [];
    } else {
      data = [];
    }
    
    console.log('[DEBUG Audit] Data extracted:', data, 'length:', data.length);
    
    // DEBUG: Log sample data to understand structure
    if (data.length > 0) {
      console.log('[DEBUG Audit] Sample row keys:', Object.keys(data[0]));
      console.log('[DEBUG Audit] Sample row:', JSON.stringify(data[0], null, 2));
      console.log('[DEBUG Audit] new_values structure:', data[0].new_values ? JSON.stringify(data[0].new_values, null, 2) : 'null');
    }
    
    const columns = [
      { key: 'created_at', label: 'Fecha', render: (v) => `<span style="font-size:.8125rem;color:var(--text-muted)">${formatDate(v)}</span>` },
      { key: 'user_first_name', label: 'Usuario', render: (v, row) => `${v || ''} ${row.user_last_name || ''}`.trim() || '—' },
      { key: 'action', label: 'Acción', render: (v) => {
        // Handle action formats like 'sale_created', 'product_updated', etc.
        const actionType = v?.replace(/_\w+$/, '') || v; // Extract base action: 'sale_created' -> 'sale'
        const colors = { create: 'var(--green)', update: 'var(--blue)', delete: 'var(--red)', login: 'var(--purple)', sale: 'var(--orange)', product: 'var(--teal)' };
        return `<span style="color:${colors[actionType] || 'var(--text-secondary)'};font-weight:600;text-transform:capitalize">${v}</span>`;
      }},
      { key: 'reference_table', label: 'Tabla', render: (v) => v ? `<code style="font-family:var(--font-mono);font-size:.75rem">${v}</code>` : '—' },
      { key: 'new_values', label: 'Detalles', render: (v) => {
        if (!v) return '—';
        // Extract key info from new_values
        const parts = [];
        if (v.status) parts.push(`Status: ${v.status}`);
        if (v.total_amount !== undefined && v.total_amount !== null) parts.push(`Monto: ${parseFloat(v.total_amount).toFixed(2)}`);
        if (v.items && Array.isArray(v.items)) parts.push(`Items: ${v.items.length}`);
        if (v.cashbox_id) parts.push(`Caja: #${v.cashbox_id}`);
        return parts.length > 0 
          ? `<span style="font-size:.8125rem">${parts.join(' | ')}</span>` 
          : '—';
      }},
    ];
    
    // Limpiar container antes de renderizar la tabla
    container.innerHTML = '';
    container.innerHTML = buildTable(columns, data, { emptyMsg: 'Sin logs de auditoría' });
    console.log('[DEBUG Audit] Table rendered');
  } catch (err) { 
    console.error('[DEBUG Audit] Error:', err);
    showError(container, err.message); 
  }
}

async function loadAuditStats() {
  const content = document.getElementById('audit-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await AuditService.getStatistics();
    const resData = res.data || {};
    
    // Handle both object and array responses
    let byAction = [];
    let byModule = [];
    
    if (Array.isArray(resData)) {
      byAction = resData;
    } else if (typeof resData === 'object') {
      byAction = resData.by_action || resData.byAction || [];
      byModule = resData.by_module || resData.byModule || [];
    }

    content.innerHTML = `
      <div class="chart-grid chart-grid-2">
        <div class="card" style="padding:0">
          <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)"><span class="card-title">Acciones por Tipo</span></div>
          ${buildTable([
            { key: 'action', label: 'Acción' },
            { key: 'count', label: 'Total', render: (v) => `<span style="font-family:var(--font-mono);font-weight:700">${v}</span>` },
            { key: 'unique_users', label: 'Usuarios únicos' },
          ], byAction, { emptyMsg: 'Sin datos' })}
        </div>
        <div class="card" style="padding:0">
          <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)"><span class="card-title">Módulos más activos</span></div>
          ${buildTable([
            { key: 'module', label: 'Módulo' },
            { key: 'count', label: 'Total acciones', render: (v) => `<span style="font-family:var(--font-mono);font-weight:700">${v}</span>` },
          ], byModule, { emptyMsg: 'Sin datos' })}
        </div>
      </div>
    `;
  } catch (err) { showError(content, err.message); }
}


/**
 * Vista Empleados
 */
export async function renderEmployees() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">👥 Empleados</h1><p class="page-subtitle">Gestión del equipo</p></div>
      <button class="btn btn-primary" onclick="window._empCreate()">+ Nuevo Empleado</button>
    </div>
    <div class="filter-bar">
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-input" id="emp-active" onchange="window._empLoad()">
          <option value="true">Activos</option><option value="false">Inactivos</option><option value="">Todos</option>
        </select>
      </div>
    </div>
    <div class="card" style="padding:0">
      <div id="emp-table"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;
  window._empLoad = loadEmployees;
  window._empCreate = () => openEmpForm(null);
  window._empEdit = (id) => openEmpForm(id);
  window._empDelete = (id) => deleteEmployee(id);
  window._empRestore = (id) => restoreEmployee(id);
  window._empPassword = (id) => changePasswordForm(id);
  await loadEmployees();
}

async function loadEmployees() {
  const container = document.getElementById('emp-table');
  showLoading(container);
  try {
    const active = document.getElementById('emp-active')?.value;
    const params = {};
    if (active !== '') {
      params.is_active = active;
      // Añadir show_deleted=true para ver empleados inactivos/eliminados
      if (active === 'false') params.show_deleted = true;
    }
    const res = await EmployeeService.getAll(params);
    const columns = [
      { key: 'first_name', label: 'Nombre', render: (v, row) => `
        <div style="display:flex;align-items:center;gap:.625rem">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:white">${v?.[0]}${row.last_name?.[0]}</div>
          <div>
            <div style="font-weight:600">${v} ${row.last_name}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${row.email}</div>
          </div>
        </div>
      `},
      { key: 'role', label: 'Rol', render: (v) => `<span style="background:var(--purple)20;color:var(--purple);padding:.1rem .5rem;border-radius:9999px;font-size:.75rem;font-weight:600">${getRoleLabel(v)}</span>` },
      { key: 'phone', label: 'Teléfono', render: (v) => v || '—' },
      { key: 'is_active', label: 'Estado', render: (v) => v ? `<span class="status-badge status-active">● Activo</span>` : `<span class="status-badge status-inactive">● Inactivo</span>` },
      { key: 'created_at', label: 'Registro', render: (v) => formatDate(v, true) },
    ];
    container.innerHTML = buildTable(columns, res.data || [], {
      emptyMsg: 'Sin empleados registrados',
      actions: (row) => `
        <div style="display:flex;gap:.375rem">
          <button class="btn btn-sm btn-ghost btn-icon" onclick="window._empEdit(${row.id})">✏️</button>
          <button class="btn btn-sm btn-ghost btn-icon" onclick="window._empPassword(${row.id})" title="Cambiar contraseña">🔑</button>
          ${row.is_active ? `<button class="btn btn-sm btn-danger btn-icon" onclick="window._empDelete(${row.id})">🗑</button>` : `<button class="btn btn-sm btn-success btn-icon" onclick="window._empRestore(${row.id})">♻️</button>`}
        </div>
      `
    });
  } catch (err) { showError(container, err.message); }
}

async function openEmpForm(id) {
  let emp = null;
  if (id) { try { const r = await EmployeeService.getById(id); emp = r.data; } catch {} }
  const isEdit = !!id;
  const fields = [
    { name: 'first_name', label: 'Nombre', required: true },
    { name: 'last_name', label: 'Apellido', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true, span: 2 },
    ...(!isEdit ? [{ name: 'password', label: 'Contraseña', type: 'password', required: true, hint: 'Mínimo 8 caracteres' }] : []),
    { name: 'role', label: 'Rol', type: 'select', required: true,
      options: [{ value:'admin',label:'Administrador'},{value:'cashier',label:'Cajero'},{value:'warehouse',label:'Almacenero'}] },
    { name: 'phone', label: 'Teléfono', placeholder: '+51999999999' },
    ...(isEdit ? [{ name: 'is_active', label: 'Empleado activo', type: 'checkbox', span: 2 }] : []),
  ];
  const modal = showModal({ title: id ? '✏️ Editar Empleado' : '+ Nuevo Empleado', content: buildForm(fields, emp || {}, { submitLabel: id ? 'Actualizar' : 'Crear Empleado', onCancel: closeModal }), size: 'md' });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (data) => {
    if (id) await EmployeeService.update(id, data);
    else await EmployeeService.create(data);
    Toast.success(id ? 'Empleado actualizado' : 'Empleado creado');
    closeModal(); loadEmployees();
  });
}

async function deleteEmployee(id) {
  if (!(await confirm('¿Eliminar este empleado?'))) return;
  try { await EmployeeService.delete(id); Toast.success('Empleado eliminado'); loadEmployees(); } catch (err) { Toast.error(err.message); }
}

async function restoreEmployee(id) {
  try { await EmployeeService.restore(id); Toast.success('Empleado restaurado'); loadEmployees(); } catch (err) { Toast.error(err.message); }
}

function changePasswordForm(id) {
  const fields = [
    { name: 'current_password', label: 'Contraseña actual', type: 'password', required: true, span: 2 },
    { name: 'new_password', label: 'Nueva contraseña', type: 'password', required: true, hint: 'Mínimo 8 caracteres', span: 2 },
  ];
  const modal = showModal({ title: '🔑 Cambiar Contraseña', content: buildForm(fields, {}, { submitLabel: 'Cambiar', onCancel: closeModal }), size: 'sm' });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (data) => {
    await EmployeeService.changePassword(id, data);
    Toast.success('Contraseña actualizada'); closeModal();
  });
}


/**
 * Vista Categorías
 */
export async function renderCategories() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">🏷️ Categorías</h1><p class="page-subtitle">Organización del catálogo</p></div>
      <button class="btn btn-primary" onclick="window._catCreate()">+ Nueva Categoría</button>
    </div>
    <div class="card" style="padding:0">
      <div id="cat-table"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;
  window._catCreate = () => openCatForm(null);
  window._catEdit = (id) => openCatForm(id);
  window._catDelete = (id) => deleteCategory(id);
  await loadCategories();
}

async function loadCategories() {
  const container = document.getElementById('cat-table');
  showLoading(container);
  try {
    const res = await CategoryService.getAll();
    const columns = [
      { key: 'name', label: 'Nombre' },
      { key: 'description', label: 'Descripción', render: (v) => v || '—' },
      { key: 'created_at', label: 'Creada', render: (v) => formatDate(v, true) },
    ];
    container.innerHTML = buildTable(columns, res.data || [], {
      emptyMsg: 'Sin categorías',
      actions: (row) => `
        <div style="display:flex;gap:.375rem">
          <button class="btn btn-sm btn-ghost btn-icon" onclick="window._catEdit(${row.id})">✏️</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="window._catDelete(${row.id})">🗑</button>
        </div>
      `
    });
  } catch (err) { showError(container, err.message); }
}

async function openCatForm(id) {
  let cat = null;
  if (id) { try { const r = await CategoryService.getById(id); cat = r.data; } catch {} }
  const fields = [
    { name: 'name', label: 'Nombre', required: true, span: 2 },
    { name: 'description', label: 'Descripción', type: 'textarea', span: 2 },
    { name: 'image_url', label: 'URL de Imagen', type: 'url', span: 2, placeholder: 'https://...' },
  ];
  const modal = showModal({ title: id ? '✏️ Editar Categoría' : '+ Nueva Categoría', content: buildForm(fields, cat || {}, { submitLabel: id ? 'Actualizar' : 'Crear', onCancel: closeModal }), size: 'sm' });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (data) => {
    if (id) await CategoryService.update(id, data);
    else await CategoryService.create(data);
    Toast.success(id ? 'Categoría actualizada' : 'Categoría creada');
    closeModal(); loadCategories();
  });
}

async function deleteCategory(id) {
  if (!(await confirm('¿Eliminar esta categoría?'))) return;
  try { await CategoryService.delete(id); Toast.success('Categoría eliminada'); loadCategories(); } catch (err) { Toast.error(err.message); }
}


/**
 * Vista Recetas
 */
export async function renderRecipes() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">💐 Recetas</h1><p class="page-subtitle">Arreglos florales y combinaciones</p></div>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-warning" onclick="window._recipeCalcCost()">💰 Calcular Costo</button>
        <button class="btn btn-primary" onclick="window._recipeCreate()">+ Nueva Receta</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="all" onclick="window._recipeTab('all')">Todas</button>
      <button class="tab-btn" data-tab="available" onclick="window._recipeTab('available')">✅ Disponibles</button>
      <button class="tab-btn" data-tab="popular" onclick="window._recipeTab('popular')">🏆 Populares</button>
    </div>
    <div id="recipe-content"></div>
  `;
  window._recipeTab = (t) => loadRecipes(t);
  window._recipeCreate = () => openRecipeForm(null);
  window._recipeEdit = (id) => openRecipeForm(id);
  window._recipeDelete = (id) => deleteRecipe(id);
  window._recipeCalcCost = () => calcCostForm();
  window._recipeToggleCatalog = (id, show) => toggleRecipeCatalog(id, show);
  loadRecipes('all');
}

async function loadRecipes(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const content = document.getElementById('recipe-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    let data;
    if (tab === 'available') data = (await RecipeService.getAvailable()).data || [];
    else if (tab === 'popular') data = (await RecipeService.getPopular({ limit: 10 })).data || [];
    else data = (await RecipeService.getAll()).data || [];

    if (!data.length) { content.innerHTML = '<div class="empty-state" style="padding:3rem">Sin recetas disponibles</div>'; return; }

    content.innerHTML = `<div class="products-grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
      ${data.map(r => `
        <div class="card" style="cursor:pointer;transition:all .2s;padding:0;overflow:hidden" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-light)'">
          ${r.image_url
            ? `<div style="height:140px;overflow:hidden;border-radius:var(--radius) var(--radius) 0 0">
                <img src="${r.image_url}" style="width:100%;height:100%;object-fit:cover"
                  onerror="this.parentElement.style.display='none'">
               </div>`
            : `<div style="height:80px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:2.5rem;border-radius:var(--radius) var(--radius) 0 0">💐</div>`
          }
          <div style="padding:.875rem">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">
              <div style="font-weight:700;font-size:1rem;flex:1;margin-right:.5rem">${r.name}</div>
              <div style="display:flex;gap:.375rem;flex-shrink:0">
                <button class="btn btn-sm btn-ghost btn-icon" onclick="window._recipeEdit(${r.id})" title="Editar">✏️</button>
                <button class="btn btn-sm btn-danger btn-icon" onclick="window._recipeDelete(${r.id})" title="Eliminar">🗑</button>
              </div>
            </div>
            <div style="margin-bottom:.625rem">
              <button
                onclick="window._recipeToggleCatalog(${r.id}, ${!r.show_in_catalog})"
                style="display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .6rem;border-radius:9999px;font-size:.75rem;font-weight:600;border:1.5px solid;cursor:pointer;transition:all .15s;background:${r.show_in_catalog ? 'var(--green)18' : 'var(--bg-elevated)'};border-color:${r.show_in_catalog ? 'var(--green)' : 'var(--border)'};color:${r.show_in_catalog ? 'var(--green)' : 'var(--text-muted)'}"
                title="${r.show_in_catalog ? 'Visible en catálogo público — clic para ocultar' : 'Oculto del catálogo — clic para mostrar'}"
              >
                <span style="width:28px;height:16px;border-radius:9999px;background:${r.show_in_catalog ? 'var(--green)' : 'var(--border)'};position:relative;transition:background .15s;flex-shrink:0">
                  <span style="position:absolute;top:2px;left:${r.show_in_catalog ? '14px' : '2px'};width:12px;height:12px;border-radius:50%;background:#fff;transition:left .15s"></span>
                </span>
                ${r.show_in_catalog ? 'En catálogo' : 'Oculto'}
              </button>
            </div>
            ${r.times_sold ? `<div style="font-size:.8125rem;color:var(--text-secondary);margin-bottom:.5rem">🏆 ${r.times_sold} vendidas</div>` : ''}
            ${r.ingredients ? `<div style="font-size:.8125rem;color:var(--text-muted);margin-bottom:.5rem">${r.ingredients.length} ingredientes</div>` : ''}
            ${r.total_cost ? `<div style="font-size:.875rem;font-weight:700;color:var(--accent);font-family:var(--font-mono)">Costo: ${formatCurrency(r.total_cost)}</div>` : ''}
            ${r.max_quantity ? `<div style="font-size:.75rem;color:var(--green);margin-top:.375rem">Máx. a producir: ${r.max_quantity}</div>` : ''}
            ${r.can_produce === false ? `<div style="font-size:.75rem;color:var(--red);margin-top:.375rem">❌ Sin stock suficiente</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
  } catch (err) { showError(content, err.message); }
}

async function openRecipeForm(id) {
  let recipe = null;
  let products = [];
  let categories = [];
  if (id) { try { const r = await RecipeService.getById(id); recipe = r.data; } catch {} }
  try { products = (await ProductService.getAll({ limit: 500 })).data || []; } catch {}
  try { categories = (await CategoryService.getAll()).data || []; } catch {}

  // Include cost_price in product options for calculations
  const productsOpts = products.map(p => ({ value: p.id, label: `${p.name} (S/ ${p.cost_price})`, cost: p.cost_price }));
  const existing = recipe?.ingredients || [];

  // Get category options for recipe
  const categoryOpts = categories.map(c => `<option value="${c.id}" ${recipe?.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('');

  const modal = showModal({
    title: id ? '✏️ Editar Receta' : '+ Nueva Receta',
    size: 'lg',
    content: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="form-group">
          <label class="form-label">Nombre de la Receta<span style="color:var(--red)">*</span></label>
          <input type="text" class="form-input" id="recipe-name" value="${recipe?.name || ''}" placeholder="Ej: Ramo Premium de Rosas" required>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría</label>
          <select class="form-input" id="recipe-category_id">
            <option value="">Seleccionar categoría...</option>
            ${categoryOpts}
          </select>
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label class="form-label">Descripción</label>
          <textarea class="form-input" id="recipe-description" rows="2" placeholder="Descripción del ramo o arreglo floral...">${recipe?.description || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Margen de Ganancia (%)</label>
          <input type="number" class="form-input" id="recipe-margin" value="100" placeholder="Ej: 100" min="0" step="5">
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:.375rem">
            <input type="checkbox" id="recipe-is_active" ${recipe?.is_active !== false ? 'checked' : ''}>
            Receta Activa
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Costo Calculado</label>
          <div id="recipe-total_cost" style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">S/ 0.00</div>
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label class="form-label" style="display:flex;align-items:center;gap:.375rem">
            🖼️ Imagen de la Receta
            <span style="font-size:.7rem;color:var(--text-muted);font-weight:400">(opcional)</span>
          </label>
          <div style="display:flex;gap:.75rem;align-items:flex-start">
            <div id="recipe-img-preview" style="
              width:72px;height:72px;border-radius:var(--radius);border:2px dashed var(--border);
              background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;
              font-size:1.5rem;flex-shrink:0;overflow:hidden;transition:border-color .2s
            ">
              ${recipe?.image_url
                ? `<img src="${recipe.image_url}" style="width:100%;height:100%;object-fit:cover;border-radius:calc(var(--radius) - 2px)">`
                : '💐'}
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:.5rem">
              <input type="url" class="form-input" id="recipe-image_url"
                value="${recipe?.image_url || ''}"
                placeholder="https://ejemplo.com/imagen.jpg">
              <p style="font-size:.75rem;color:var(--text-muted);margin:0">
                Pega la URL de la imagen. Acepta jpg, png, webp, etc.
              </p>
            </div>
          </div>
        </div>
        <div style="grid-column:span 2">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
            <label class="form-label">Ingredientes</label>
            <button class="btn btn-ghost btn-sm" onclick="window._addIngRow()">+ Agregar</button>
          </div>
          <div id="ing-rows" style="display:flex;flex-direction:column;gap:.625rem">
            ${existing.map(ing => renderIngRow(productsOpts, ing)).join('')}
          </div>
        </div>
        <div class="form-actions" style="grid-column:span 2">
          <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="window._saveRecipe(${id || 'null'})">💾 Guardar Receta</button>
        </div>
      </div>
    `
  });

  // Function to calculate and display total cost
  const calcRecipeCost = () => {
    const rows = document.querySelectorAll('.ing-row');
    let totalCost = 0;
    rows.forEach(row => {
      const pid = row.querySelector('.ing-product').value;
      const qty = parseFloat(row.querySelector('.ing-qty').value) || 0;
      if (pid && qty > 0) {
        const productOpt = productsOpts.find(p => p.value == pid);
        if (productOpt && productOpt.cost) {
          totalCost += productOpt.cost * qty;
        }
      }
    });
    const costEl = document.getElementById('recipe-total_cost');
    if (costEl) costEl.textContent = `S/ ${totalCost.toFixed(2)}`;
    return totalCost;
  };

  // Add event listeners to calculate cost on change
  setTimeout(() => {
    document.getElementById('ing-rows')?.addEventListener('change', calcRecipeCost);
    document.getElementById('recipe-margin')?.addEventListener('change', calcRecipeCost);
    calcRecipeCost(); // Initial calculation

    // Live preview for recipe image URL
    document.getElementById('recipe-image_url')?.addEventListener('input', (e) => {
      const preview = document.getElementById('recipe-img-preview');
      const url = e.target.value.trim();
      if (url) {
        preview.style.borderColor = 'var(--accent)';
        preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:calc(var(--radius) - 2px)"
          onerror="this.parentElement.innerHTML='❌';this.parentElement.style.borderColor='var(--red)'">`;
      } else {
        preview.style.borderColor = '';
        preview.innerHTML = '💐';
      }
    });
  }, 100);

  // Get products with disabled state for already selected items
  const getProductsWithDupeCheck = () => {
    const existingProducts = new Set();
    document.querySelectorAll('.ing-row').forEach(row => {
      const pid = row.querySelector('.ing-product')?.value;
      if (pid) existingProducts.add(pid);
    });
    return productsOpts.map(p => ({
      ...p,
      isDisabled: existingProducts.has(String(p.value))
    }));
  };

  // Update all dropdowns to disable already selected products
  const updateAllDropdowns = () => {
    const productsWithCheck = getProductsWithDupeCheck();
    document.querySelectorAll('.ing-product').forEach(select => {
      const currentVal = select.value;
      Array.from(select.options).forEach(opt => {
        const prod = productsWithCheck.find(p => String(p.value) === opt.value);
        opt.disabled = prod?.isDisabled && opt.value !== currentVal;
      });
    });
  };

  window._addIngRow = () => {
    const availableCount = productsOpts.filter(p => !getProductsWithDupeCheck().find(ep => String(ep.value) === String(p.value) && ep.isDisabled)).length;
    
    if (availableCount === 0) {
      Toast.warning('Todos los productos ya están agregados. Aumenta la cantidad en las filas existentes.');
      return;
    }

    document.getElementById('ing-rows').insertAdjacentHTML('beforeend', renderIngRow(productsOpts));
    
    // Re-attach event listeners after adding row
    setTimeout(() => {
      document.querySelectorAll('.ing-row').forEach(row => {
        row.removeEventListener('change', calcRecipeCost);
        row.addEventListener('change', calcRecipeCost);
        // Update dropdowns when product changes
        row.querySelector('.ing-product')?.addEventListener('change', updateAllDropdowns);
      });
      updateAllDropdowns();
    }, 50);
  };

  window._saveRecipe = async (recipeId) => {
    const name = document.getElementById('recipe-name').value.trim();
    if (!name) { Toast.warning('El nombre es requerido'); return; }

    // Get form values
    const description = document.getElementById('recipe-description').value.trim();
    const category_id = document.getElementById('recipe-category_id').value ? Number(document.getElementById('recipe-category_id').value) : null;
    const margin = Number(document.getElementById('recipe-margin').value) || 100;
    const is_active = document.getElementById('recipe-is_active').checked;

    // Get ingredients and calculate costs (with duplicate merging)
    const rows = document.querySelectorAll('.ing-row');
    const ingredientsMap = new Map();
    let total_cost = 0;
    rows.forEach(row => {
      const pid = row.querySelector('.ing-product').value;
      const qty = parseFloat(row.querySelector('.ing-qty').value);
      if (pid && qty > 0) {
        // Merge duplicate products by summing quantities
        if (ingredientsMap.has(Number(pid))) {
          ingredientsMap.set(Number(pid), ingredientsMap.get(Number(pid)) + qty);
        } else {
          ingredientsMap.set(Number(pid), qty);
        }
        const productOpt = productsOpts.find(p => p.value == pid);
        if (productOpt && productOpt.cost) {
          total_cost += productOpt.cost * qty;
        }
      }
    });
    // Convert map to array
    const ingredients = Array.from(ingredientsMap.entries()).map(([product_id, quantity]) => ({ product_id, quantity }));

    if (!ingredients.length) { Toast.warning('Agrega al menos un ingrediente'); return; }

    // Calculate suggested price (cost + margin)
    const suggested_price = total_cost * (1 + margin / 100);

    // Prepare the request body with all fields
    const imageUrl = document.getElementById('recipe-image_url')?.value.trim() || null;
    const recipeData = {
      name,
      description: description || null,
      category_id,
      total_cost: Math.round(total_cost * 100) / 100,
      suggested_price: Math.round(suggested_price * 100) / 100,
      is_active,
      ingredients,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    };

    // Add created_at only for new recipes
    if (!recipeId) {
      recipeData.created_at = new Date().toISOString();
    }

    console.log('Recipe create/update payload:', recipeData);

    try {
      if (recipeId) await RecipeService.update(recipeId, recipeData);
      else await RecipeService.create(recipeData);
      Toast.success(recipeId ? 'Receta actualizada' : 'Receta creada');
      closeModal(); loadRecipes('all');
    } catch (err) { Toast.error(err.message); }
  };

  window._productsOpts = productsOpts;
  window.closeModal = closeModal;
  if (!existing.length) window._addIngRow();
}

function renderIngRow(productsOpts, ing = null) {
  const existingProducts = new Set();
  document.querySelectorAll('.ing-row').forEach(row => {
    const pid = row.querySelector('.ing-product')?.value;
    if (pid && row !== document.activeElement?.closest('.ing-row')) existingProducts.add(pid);
  });
  
  const opts = productsOpts.map(p => {
    const isDisabled = existingProducts.has(String(p.value)) && ing?.product_id != p.value;
    return `<option value="${p.value}" ${ing?.product_id == p.value ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${p.label}</option>`;
  }).join('');
  return `<div class="ing-row" style="display:grid;grid-template-columns:1fr auto auto;gap:.5rem;align-items:center">
    <select class="form-input ing-product"><option value="">Seleccionar producto...</option>${opts}</select>
    <input type="number" class="form-input ing-qty" placeholder="Cant." value="${ing?.quantity || ''}" min="0.01" step="0.01" style="width:100px">
    <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">✕</button>
  </div>`;
}

async function deleteRecipe(id) {
  if (!(await confirm('¿Eliminar esta receta?'))) return;
  try { await RecipeService.delete(id); Toast.success('Receta eliminada'); loadRecipes('all'); } catch (err) { Toast.error(err.message); }
}

async function toggleRecipeCatalog(id, show) {
  try {
    await RecipeService.toggleCatalog(id, show);
    Toast.success(show ? 'Receta visible en catálogo' : 'Receta oculta del catálogo');
    const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab || 'all';
    loadRecipes(activeTab);
  } catch (err) { Toast.error(err.message); }
}

async function calcCostForm() {
  let products = [];
  try { products = (await ProductService.getAll({ limit: 500 })).data || []; } catch {}
  const productsOpts = products.map(p => ({ value: p.id, label: `${p.name} (S/ ${p.cost_price})` }));

  showModal({
    title: '💰 Calcular Costo de Receta Personalizada',
    size: 'md',
    content: `
      <div>
        <div id="calc-ing-rows" style="display:flex;flex-direction:column;gap:.625rem"></div>
        <button class="btn btn-ghost btn-sm" style="margin-top:.75rem" onclick="window._addCalcRow()">+ Agregar ingrediente</button>
        <div class="form-actions">
          <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="window._calcCost()">Calcular</button>
        </div>
        <div id="calc-result" style="margin-top:1rem"></div>
      </div>
    `
  });
  window.closeModal = closeModal;
  window._calcCostOpts = productsOpts;
  window._addCalcRow = () => {
    const opts = productsOpts.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
    document.getElementById('calc-ing-rows').insertAdjacentHTML('beforeend', `
      <div class="ing-row" style="display:grid;grid-template-columns:1fr auto auto;gap:.5rem;align-items:center">
        <select class="form-input ing-product"><option value="">Seleccionar...</option>${opts}</select>
        <input type="number" class="form-input ing-qty" placeholder="Cant." min="0.01" step="0.01" style="width:100px">
        <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()">✕</button>
      </div>`);
  };
  window._calcCost = async () => {
    const rows = document.querySelectorAll('.ing-row');
    const ingredients = [];
    rows.forEach(r => {
      const pid = r.querySelector('.ing-product').value;
      const qty = parseFloat(r.querySelector('.ing-qty').value);
      if (pid && qty > 0) ingredients.push({ product_id: Number(pid), quantity: qty });
    });
    if (!ingredients.length) { Toast.warning('Agrega ingredientes'); return; }
    try {
      const res = await RecipeService.calculateCost(ingredients);
      const d = res.data;
      document.getElementById('calc-result').innerHTML = `
        <div style="padding:1rem;background:var(--bg-elevated);border-radius:var(--radius);border:1px solid var(--accent)30">
          <div style="font-size:1.25rem;font-weight:800;color:var(--accent);font-family:var(--font-mono)">Costo Total: ${formatCurrency(d.totalCost)}</div>
          <div style="margin-top:.75rem;display:flex;flex-direction:column;gap:.375rem">
            ${(d.breakdown || []).map(b => `<div style="display:flex;justify-content:space-between;font-size:.875rem"><span>${b.product_id}</span><span style="font-family:var(--font-mono)">${formatCurrency(b.cost)}</span></div>`).join('')}
          </div>
        </div>
      `;
    } catch (err) { Toast.error(err.message); }
  };
  window._addCalcRow();
}

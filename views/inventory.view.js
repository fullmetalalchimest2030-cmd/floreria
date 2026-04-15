/**
 * Vista Inventario — Kardex, movimientos, estadísticas
 */
import { InventoryService, ProductService } from '../services/api.js';
import { formatCurrency, formatDate, formatNumber, movementTypeLabel } from '../utils/helpers.js';
import { Toast, showModal, closeModal, buildTable, showLoading, showError } from '../components/ui.js';
import { buildForm, attachFormHandlers } from '../components/form.js';
import Store from '../utils/store.js';

export async function renderInventory() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📦 Inventario</h1>
        <p class="page-subtitle">Movimientos, kardex y control de stock</p>
      </div>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-secondary" onclick="window._invNewMovement()">+ Movimiento</button>
        <button class="btn btn-warning" onclick="window._invBulk()">📋 Ingreso Masivo</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab-btn active" data-tab="movements" onclick="window._invTab('movements')">📋 Movimientos</button>
      <button class="tab-btn" data-tab="kardex" onclick="window._invTab('kardex')">📊 Kardex</button>
      <button class="tab-btn" data-tab="summary" onclick="window._invTab('summary')">📈 Resumen</button>
      <button class="tab-btn" data-tab="lowstock" onclick="window._invTab('lowstock')">⚠️ Stock Bajo</button>
    </div>

    <div id="inv-content"></div>
  `;

  window._invTab = (tab) => switchTab(tab);
  window._invNewMovement = () => openMovementForm();
  window._invBulk = () => openBulkForm();
  window._invViewKardex = (productId, name) => loadKardex(productId, name);

  switchTab('movements');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  switch (tab) {
    case 'movements': loadMovements(); break;
    case 'kardex': loadKardexSearch(); break;
    case 'summary': loadSummary(); break;
    case 'lowstock': loadLowStock(); break;
  }
}

async function loadMovements() {
  const content = document.getElementById('inv-content');
  content.innerHTML = `
    <div class="filter-bar">
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select class="form-input" id="inv-type-filter" onchange="window._invLoadMovements()">
          <option value="">Todos</option>
          <option value="purchase">Entradas (IN)</option>
          <option value="sale">Salidas (OUT)</option>
          <option value="ADJUSTMENT">Ajuste</option>
          <option value="WASTE">Merma</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Desde</label>
        <input type="date" class="form-input" id="inv-date-from" onchange="window._invLoadMovements()">
      </div>
      <div class="form-group">
        <label class="form-label">Hasta</label>
        <input type="date" class="form-input" id="inv-date-to" onchange="window._invLoadMovements()">
      </div>
      <button class="btn btn-ghost btn-sm" onclick="window._invLoadMovements()">🔄 Filtrar</button>
    </div>
    <div class="card" style="padding:0">
      <div id="inv-movements-table"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;
  window._invLoadMovements = loadMovementsData;
  await loadMovementsData();
}

async function loadMovementsData() {
  const container = document.getElementById('inv-movements-table');
  if (!container) return;
  showLoading(container);
  try {
    const params = {};
    const typeEl = document.getElementById('inv-type-filter');
    const fromEl = document.getElementById('inv-date-from');
    const toEl = document.getElementById('inv-date-to');
    if (typeEl?.value) params.movement_type = typeEl.value;
    if (fromEl?.value) params.start_date = fromEl.value;
    if (toEl?.value) params.end_date = toEl.value;

    const res = await InventoryService.getAll({ ...params, limit: 100 });
    const data = res.data || [];

    const columns = [
      { key: 'created_at', label: 'Fecha', render: (v) => `<span style="color:var(--text-muted);font-size:.8125rem">${formatDate(v, true)}</span>` },
      { key: 'product_name', label: 'Producto' },
      {
        key: 'movement_type_code', label: 'Tipo',
        render: (v) => {
          const isIn = v === 'purchase' || v === 'IN' || v === 'adjustment_in';
          return `<span class="status-badge ${isIn ? 'status-active' : 'status-cancelled'}">${isIn ? '↑' : '↓'} ${v}</span>`;
        }
      },
      { key: 'quantity', label: 'Cantidad', render: (v) => `<span style="font-family:var(--font-mono);font-weight:700">${parseInt(v) || 0}</span>` },
      { key: 'unit_cost', label: 'Costo Unit.', render: (v) => v ? formatCurrency(v) : '—' },
      { key: 'user_first_name', label: 'Registrado por', render: (v, row) => `${v || ''} ${row.user_last_name || ''}`.trim() || '—' },
    ];

    container.innerHTML = buildTable(columns, data, { emptyMsg: 'Sin movimientos en el período' });
  } catch (err) {
    showError(container, err.message);
  }
}

function loadKardexSearch() {
  const content = document.getElementById('inv-content');
  content.innerHTML = `
    <div class="card" style="max-width:500px;margin-bottom:1rem">
      <div class="card-title" style="margin-bottom:1rem">Seleccionar Producto para Kardex</div>
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" class="form-input" id="kardex-search" placeholder="Buscar producto...">
      </div>
      <div id="kardex-product-list" style="margin-top:.75rem;display:flex;flex-direction:column;gap:.5rem"></div>
    </div>
    <div id="kardex-content"></div>
  `;

  let timer;
  document.getElementById('kardex-search').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => searchProductsForKardex(e.target.value), 300);
  });
}

async function searchProductsForKardex(q) {
  const list = document.getElementById('kardex-product-list');
  if (!q.trim()) { list.innerHTML = ''; return; }
  try {
    const res = await ProductService.search(q);
    const data = res.data || [];
    list.innerHTML = data.slice(0, 8).map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.625rem .75rem;background:var(--bg-elevated);border-radius:var(--radius);cursor:pointer;border:1px solid var(--border-light)"
        onclick="window._invViewKardex(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
        <span style="font-weight:600">${p.name}</span>
        <span style="font-size:.75rem;color:var(--text-muted)">Stock: ${parseInt(p.stock_cached) || 0}</span>
      </div>
    `).join('') || '<div class="empty-state">Sin resultados</div>';
  } catch {}
}

async function loadKardex(productId, productName) {
  const container = document.getElementById('kardex-content');
  container.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await InventoryService.getKardex(productId, { limit: 50 });
    const data = res.data || [];

    const columns = [
      { key: 'created_at', label: 'Fecha', render: (v) => `<span style="font-size:.8125rem;color:var(--text-muted)">${formatDate(v, true)}</span>` },
      { key: 'movement_type_code', label: 'Tipo' },
      {
        key: 'quantity', label: 'Entrada/Salida',
        render: (v, row) => {
          const isIn = row.movement_type_code === 'purchase' || row.movement_type_code?.includes('in');
          return `<span style="color:${isIn ? 'var(--green)' : 'var(--red)'};font-weight:700;font-family:var(--font-mono)">${isIn ? '+' : '-'}${parseInt(Math.abs(v)) || 0}</span>`;
        }
      },
      { key: 'unit_cost', label: 'Costo', render: (v) => v ? formatCurrency(v) : '—' },
      { key: 'balance', label: 'Saldo', render: (v) => `<span style="font-weight:700;font-family:var(--font-mono)">${parseInt(v) || 0}</span>` },
      { key: 'user_first_name', label: 'Usuario', render: (v, row) => `${v || ''} ${row.user_last_name || ''}`.trim() },
    ];

    container.innerHTML = `
      <div class="card" style="padding:0">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)">
          <span class="card-title">Kardex — ${productName}</span>
          <span style="float:right;font-size:.75rem;color:var(--text-muted)">Últimos 50 movimientos</span>
        </div>
        ${buildTable(columns, data, { emptyMsg: 'Sin movimientos en el kardex' })}
      </div>
    `;
  } catch (err) {
    showError(container, err.message);
  }
}

async function loadSummary() {
  const content = document.getElementById('inv-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const [summaryRes, statsRes] = await Promise.all([
      InventoryService.getSummary(),
      InventoryService.getStats(),
    ]);
    const summary = summaryRes.data?.categories || [];
    const stats = statsRes.data?.summary || {};

    content.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:1.5rem">
        <div class="kpi-card green">
          <span class="kpi-icon">↑</span>
<div class="kpi-value">${parseInt(stats.total_inbound) || 0}</div>
          <div class="kpi-delta up">${parseInt(stats.inbound_movements) || 0} movimientos</div>
        </div>
        <div class="kpi-card blue">
          <span class="kpi-icon">📋</span>
          <div class="kpi-value">${parseInt(stats.total_outbound) || 0}</div>
          <div class="kpi-delta down">${parseInt(stats.outbound_movements) || 0} movimientos</div>
        </div>
        <div class="kpi-card blue">
          <span class="kpi-icon">📋</span>
          <div class="kpi-value">${parseInt(stats.total_movements) || 0}</div>
          <div class="kpi-label">Total Movimientos</div>
        </div>
      </div>

      <div class="card" style="padding:0;margin-bottom:1.5rem">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)">
          <span class="card-title">Resumen por Categoría</span>
        </div>
        ${buildTable(
          [
            { key: 'category_name', label: 'Categoría' },
            { key: 'total_products', label: 'Productos', render: (v) => `<span style="font-family:var(--font-mono)">${parseInt(v) || 0}</span>` },
            { key: 'total_value', label: 'Valor Total', render: (v) => `<span style="color:var(--accent);font-weight:700">${formatCurrency(v)}</span>` },
          ],
          summary,
          { emptyMsg: 'Sin datos de inventario' }
        )}
      </div>
    `;
  } catch (err) {
    showError(content, err.message);
  }
}

async function loadLowStock() {
  const content = document.getElementById('inv-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await InventoryService.getLowStock();
    const data = res.data || [];

    const columns = [
      { key: 'name', label: 'Producto' },
      { key: 'category', label: 'Categoría' },
      {
        key: 'stock_cached', label: 'Stock Actual',
        render: (v, row) => {
          const stockVal = parseInt(v) || 0;
          const minStockVal = parseInt(row.min_stock) || 1;
          const pct = Math.min(100, (stockVal / Math.max(1, minStockVal)) * 100);
          return `<div class="stock-bar-wrap">
            <span style="font-family:var(--font-mono);font-weight:700;color:var(--red)">${stockVal}</span>
            <div class="stock-bar-bg"><div class="stock-bar-fill" style="width:${pct}%;background:var(--red)"></div></div>
          </div>`;
        }
      },
      { key: 'min_stock', label: 'Stock Mínimo', render: (v) => `<span style="font-family:var(--font-mono)">${parseInt(v) || 0}</span>` },
      {
        key: 'id', label: 'Déficit',
        render: (v, row) => {
          const deficit = parseInt(row.min_stock || 0) - parseInt(row.stock_cached || 0);
          return `<span style="color:var(--red);font-weight:700">-${parseInt(deficit) || 0}</span>`;
        }
      },
    ];

    content.innerHTML = `
      <div class="card" style="padding:0">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
          <span class="card-title">⚠️ Productos con Stock Bajo (${data.length})</span>
          <button class="btn btn-primary btn-sm" onclick="window._invNewMovement()">+ Agregar Stock</button>
        </div>
        ${buildTable(columns, data, { emptyMsg: '✅ Todo el stock está en niveles saludables' })}
      </div>
    `;
  } catch (err) {
    showError(content, err.message);
  }
}

async function openMovementForm() {
  let products = [];
  try {
    const res = await ProductService.getAll({ limit: 500 });
    products = res.data || [];
  } catch {}

  const user = Store.get('user');
  const fields = [
    { name: 'product_id', label: 'Producto', type: 'select', required: true,
      options: products.map(p => ({ value: p.id, label: `${p.name} (Stock: ${parseInt(p.stock_cached) || 0})` })), span: 2 },
    { name: 'movement_type', label: 'Tipo de Movimiento', type: 'select', required: true,
      options: [
        { value: 'IN', label: '↑ Entrada (IN)' },
        { value: 'OUT', label: '↓ Salida (OUT)' },
        { value: 'ADJUSTMENT', label: '⟳ Ajuste' },
        { value: 'WASTE', label: '🗑 Merma' },
      ]
    },
    { name: 'quantity', label: 'Cantidad', type: 'number', required: true, min: '1' },
    { name: 'reason', label: 'Motivo', type: 'select', required: true,
      options: [
        { value: 'purchase', label: 'Compra' },
        { value: 'return', label: 'Devolución' },
        { value: 'adjustment', label: 'Ajuste' },
        { value: 'sale', label: 'Venta' },
        { value: 'damage', label: 'Daño' },
        { value: 'theft', label: 'Robo' },
        { value: 'production', label: 'Producción' },
        { value: 'transfer', label: 'Transferencia' },
        { value: 'initial_stock', label: 'Stock inicial' },
      ]
    },
    { name: 'notes', label: 'Notas adicionales', type: 'textarea', span: 2 },
  ];

  const modal = showModal({
    title: '+ Nuevo Movimiento de Inventario',
    content: buildForm(fields, { user_id: user?.id }, { submitLabel: 'Registrar Movimiento', onCancel: closeModal }),
    size: 'md',
  });
  const form = modal.querySelector('#dynamic-form');
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(form, async (data) => {
    // Convert string IDs to numbers for backend validation
    data.product_id = data.product_id ? Number(data.product_id) : null;
    data.user_id = user?.id ? Number(user.id) : null;
    data.quantity = data.quantity ? Number(data.quantity) : null;
    
    // Convert null to empty string for text fields
    if (data.notes === null) data.notes = '';
    if (data.reason === null) data.reason = '';
    
    await InventoryService.create(data);
    Toast.success('Movimiento registrado');
    closeModal();
    switchTab('movements');
  });
}

async function openBulkForm() {
  showModal({
    title: '📋 Ingreso Masivo de Inventario',
    size: 'lg',
    content: `
      <p style="color:var(--text-secondary);margin-bottom:1rem;font-size:.875rem">
        Agrega múltiples movimientos en una sola operación. Cada línea es un movimiento separado.
      </p>
      <div id="bulk-rows" style="display:flex;flex-direction:column;gap:.75rem"></div>
      <button class="btn btn-ghost btn-sm" style="margin-top:.75rem" onclick="window._addBulkRow()">+ Agregar fila</button>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="window._submitBulk()">Procesar Todos</button>
      </div>
    `,
  });

  window._addBulkRow = addBulkRow;
  window._submitBulk = submitBulk;
  window.closeModal = closeModal;

  // Cargar productos y agregar primera fila
  window._bulkProducts = [];
  try {
    const res = await ProductService.getAll({ limit: 500 });
    window._bulkProducts = res.data || [];
  } catch {}
  addBulkRow();
}

function addBulkRow() {
  const container = document.getElementById('bulk-rows');
  const idx = container.children.length;
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:.5rem;align-items:end';
  const productOptions = (window._bulkProducts || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  row.innerHTML = `
    <div><label class="form-label">Producto</label><select class="form-input"><option value="">Seleccionar...</option>${productOptions}</select></div>
    <div><label class="form-label">Tipo</label>
      <select class="form-input">
        <option value="IN">IN</option><option value="OUT">OUT</option>
        <option value="ADJUSTMENT">Ajuste</option><option value="WASTE">Merma</option>
      </select>
    </div>
    <div><label class="form-label">Cantidad</label><input type="number" class="form-input" value="1" min="1"></div>
    <div><label class="form-label">Motivo</label><input type="text" class="form-input" placeholder="Compra..."></div>
    <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.parentElement.remove()" style="margin-bottom:0">✕</button>
  `;
  container.appendChild(row);
}

async function submitBulk() {
  const rows = document.querySelectorAll('#bulk-rows > div');
  const movements = [];
  rows.forEach(row => {
    const selects = row.querySelectorAll('select');
    const inputs = row.querySelectorAll('input');
    const productId = selects[0]?.value;
    const type = selects[1]?.value;
    const qty = parseInt(inputs[0]?.value);
    const reason = inputs[1]?.value;
    if (productId && type && qty > 0) {
      movements.push({ product_id: Number(productId), movement_type: type, quantity: qty, reason: reason || 'Ingreso masivo' });
    }
  });
  if (!movements.length) { Toast.warning('Agrega al menos un movimiento'); return; }
  const user = Store.get('user');
  
  // Add user_id to each movement
  const userId = user?.id ? Number(user.id) : null;
  movements.forEach(m => { m.user_id = userId; });
  
  try {
    const res = await InventoryService.bulk(movements);
    Toast.success(`${res.data.created} movimientos procesados`);
    closeModal();
    switchTab('movements');
  } catch (err) { Toast.error(err.message); }
}

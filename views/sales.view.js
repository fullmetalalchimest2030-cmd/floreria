/**
 * Vista Ventas
 */
import { SaleService } from '../services/api.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import { Toast, showModal, closeModal, confirm, buildTable, showLoading, showError } from '../components/ui.js';

export async function renderSales() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">🧾 Ventas</h1><p class="page-subtitle">Historial y gestión de ventas</p></div>
      <button class="btn btn-secondary btn-sm" onclick="window._salesLoad()">🔄</button>
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="all" onclick="window._salesTab('all')">Todas</button>
      <button class="tab-btn" data-tab="today" onclick="window._salesTab('today')">Hoy</button>
      <button class="tab-btn" data-tab="stats" onclick="window._salesTab('stats')">Estadísticas</button>
    </div>
    <div id="sales-content"></div>
  `;
  window._salesTab = (t) => switchSalesTab(t);
  window._salesLoad = () => switchSalesTab('all');
  window._viewSale = (id) => viewSaleDetail(id);
  window._cancelSale = (id) => cancelSale(id);
  switchSalesTab('all');
}

function switchSalesTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  switch (tab) {
    case 'all': loadSales(); break;
    case 'today': loadTodaySales(); break;
    case 'stats': loadSaleStats(); break;
  }
}

async function loadSales() {
  const content = document.getElementById('sales-content');
  content.innerHTML = `
    <div class="filter-bar">
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-input" id="sale-status" onchange="window._salesLoad()">
          <option value="">Todos</option><option value="completed">Completada</option>
          <option value="pending">Pendiente</option><option value="cancelled">Cancelada</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Desde</label>
        <input type="date" class="form-input" id="sale-from" onchange="window._salesLoad()">
      </div>
      <div class="form-group">
        <label class="form-label">Hasta</label>
        <input type="date" class="form-input" id="sale-to" onchange="window._salesLoad()">
      </div>
    </div>
    <div class="card" style="padding:0">
      <div id="sales-table"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;
  await loadSalesData();
}

async function loadSalesData() {
  const container = document.getElementById('sales-table');
  if (!container) return;
  showLoading(container);
  try {
    const params = {};
    const s = document.getElementById('sale-status')?.value;
    const f = document.getElementById('sale-from')?.value;
    const t = document.getElementById('sale-to')?.value;
    if (s) params.status = s;
    if (f) params.start_date = f;
    if (t) params.end_date = t;
    const res = await SaleService.getAll({ ...params, limit: 100 });
    const columns = [
      { key: 'id', label: '#', render: (v) => `<code style="font-family:var(--font-mono)">#${v}</code>` },
      { key: 'created_at', label: 'Fecha', render: (v) => formatDate(v, true) },
      { key: 'user_first_name', label: 'Vendedor', render: (v, row) => `${v || ''} ${row.user_last_name || ''}`.trim() },
      { key: 'customer_identifier', label: 'Cliente', render: (v) => v || '—' },
      { key: 'total_amount', label: 'Total', render: (v) => `<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">${formatCurrency(v)}</span>` },
      { key: 'status', label: 'Estado', render: (v) => `<span class="status-badge status-${v}">${v}</span>` },
    ];
    container.innerHTML = buildTable(columns, res.data || [], {
      emptyMsg: 'Sin ventas en este período',
      actions: (row) => `
        <div style="display:flex;gap:.375rem">
          <button class="btn btn-sm btn-ghost btn-icon" onclick="window._viewSale(${row.id})" title="Ver detalle">👁</button>
          ${row.status === 'pending' ? `<button class="btn btn-sm btn-danger btn-icon" onclick="window._cancelSale(${row.id})" title="Cancelar">✕</button>` : ''}
        </div>
      `
    });
  } catch (err) { showError(container, err.message); }
}

async function loadTodaySales() {
  const content = document.getElementById('sales-content');
  content.innerHTML = `<div class="card" style="padding:0"><div id="today-sales-table"><div class="page-loading"><div class="spinner"></div></div></div></div>`;
  try {
    const res = await SaleService.getToday();
    const data = res.data || [];
    // FIX: Convert total_amount to number to avoid string concatenation
    const total = data.reduce((s, v) => s + (parseFloat(v.total_amount) || 0), 0);
    const columns = [
      { key: 'id', label: '#', render: (v) => `<code>#${v}</code>` },
      { key: 'created_at', label: 'Hora', render: (v) => new Date(v).toLocaleTimeString('es-PE') },
      { key: 'customer_identifier', label: 'Cliente', render: (v) => v || 'Sin cliente' },
      { key: 'total_amount', label: 'Total', render: (v) => `<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">${formatCurrency(v)}</span>` },
      { key: 'status', label: 'Estado', render: (v) => `<span class="status-badge status-${v}">${v}</span>` },
    ];
    document.getElementById('today-sales-table').innerHTML = `
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between">
        <span class="card-title">Ventas de Hoy (${data.length})</span>
        <span style="font-size:1rem;font-weight:700;color:var(--green)">Total: ${formatCurrency(total)}</span>
      </div>
      ${buildTable(columns, data, { emptyMsg: 'Sin ventas hoy' })}
    `;
  } catch (err) { showError(document.getElementById('today-sales-table'), err.message); }
}

async function loadSaleStats() {
  const content = document.getElementById('sales-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await SaleService.getStats();
    // FIX: Map API response structure to expected field names
    const apiData = res.data || {};
    const summary = apiData.summary || {};
    const d = {
      total_revenue: summary.total_amount || 0,
      total_transactions: summary.total_sales || 0,
      average_ticket: summary.average_sale || 0
    };
    // DEBUG: Log API response
    console.log('[DEBUG] getStats response:', res.data);
    console.log('[DEBUG] Mapped d:', d);
    content.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card accent"><span class="kpi-icon">💰</span><div class="kpi-value">${formatCurrency(d.total_revenue)}</div><div class="kpi-label">Ingresos Totales</div></div>
        <div class="kpi-card green"><span class="kpi-icon">🧾</span><div class="kpi-value">${d.total_transactions || 0}</div><div class="kpi-label">Transacciones</div></div>
        <div class="kpi-card blue"><span class="kpi-icon">📊</span><div class="kpi-value">${formatCurrency(d.average_ticket)}</div><div class="kpi-label">Ticket Promedio</div></div>
      </div>
    `;
  } catch (err) { showError(content, err.message); }
}

async function viewSaleDetail(id) {
  showModal({ title: `🧾 Detalle Venta #${id}`, size: 'md', content: `<div class="page-loading"><div class="spinner"></div></div>` });
  try {
    const res = await SaleService.getDetailed(id);
    const s = res.data || {};
    const items = s.items || [];
    document.querySelector('#modal-overlay .modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
        <div><span style="color:var(--text-muted);font-size:.75rem">ESTADO</span><br><span class="status-badge status-${s.status}">${s.status}</span></div>
        <div><span style="color:var(--text-muted);font-size:.75rem">FECHA</span><br><span>${formatDate(s.created_at)}</span></div>
        <div><span style="color:var(--text-muted);font-size:.75rem">CLIENTE</span><br><span>${s.customer_identifier || s.customer_name || 'Sin cliente'}</span></div>
        <div><span style="color:var(--text-muted);font-size:.75rem">VENDEDOR</span><br><span>${s.user_first_name || ''} ${s.user_last_name || ''}</span></div>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:1rem">
        <table style="width:100%;border-collapse:collapse;font-size:.875rem">
          <thead><tr style="background:var(--bg-elevated)">
            <th style="padding:.625rem 1rem;text-align:left;color:var(--text-secondary);font-size:.75rem">Producto</th>
            <th style="padding:.625rem 1rem;text-align:right;color:var(--text-secondary);font-size:.75rem">Cant.</th>
            <th style="padding:.625rem 1rem;text-align:right;color:var(--text-secondary);font-size:.75rem">Precio</th>
            <th style="padding:.625rem 1rem;text-align:right;color:var(--text-secondary);font-size:.75rem">Subtotal</th>
          </tr></thead>
          <tbody>${items.map(i => `<tr><td style="padding:.625rem 1rem;border-top:1px solid var(--border-light)">${i.name || i.product_name}</td>
            <td style="padding:.625rem 1rem;text-align:right;border-top:1px solid var(--border-light)">${i.quantity}</td>
            <td style="padding:.625rem 1rem;text-align:right;border-top:1px solid var(--border-light)">${formatCurrency(i.price)}</td>
            <td style="padding:.625rem 1rem;text-align:right;border-top:1px solid var(--border-light);font-weight:700">${formatCurrency(i.price * i.quantity)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <div style="text-align:right;font-size:1.25rem;font-weight:800;color:var(--accent)">TOTAL: ${formatCurrency(s.total_amount)}</div>
    `;
  } catch (err) {
    document.querySelector('#modal-overlay .modal-body').innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
  }
}

async function cancelSale(id) {
  if (!(await confirm('¿Cancelar esta venta?', 'Cancelar Venta'))) return;
  try {
    await SaleService.cancel(id);
    Toast.success('Venta cancelada');
    loadSalesData();
  } catch (err) { Toast.error(err.message); }
}

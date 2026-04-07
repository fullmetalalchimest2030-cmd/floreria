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
  showModal({ title: `🧾 Detalle Venta #${id}`, size: 'lg', content: `<div class="page-loading"><div class="spinner"></div></div>` });
  try {
    const res = await SaleService.getDetailed(id);
    const s = res.data || {};
    const items = s.items || [];
    const isDark = document.body.classList.contains('dark-mode');
    const textMuted = isDark ? '#9ca3af' : '#6b7280';
    const border = isDark ? '#374151' : '#e5e7eb';
    const bgElevated = isDark ? '#1f2937' : '#f9fafb';
    const bgRow = isDark ? '#111827' : '#ffffff';

    const s = res.data || {};
    const items = s.items || [];
    const isDark = document.body.classList.contains('dark-mode');
    const textMuted = isDark ? '#9ca3af' : '#6b7280';
    const border = isDark ? '#374151' : '#e5e7eb';
    const bgElevated = isDark ? '#1f2937' : '#f9fafb';
    const bgRow = isDark ? '#111827' : '#ffffff';

    document.querySelector('#modal-overlay .modal-body').innerHTML = `
      <div style="margin-bottom:1.25rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
          <div>
            <span style="color:${textMuted};font-size:.7rem;letter-spacing:.05em;text-transform:uppercase">Ticket</span>
            <div style="font-family:var(--font-mono);font-size:1rem;font-weight:700">${s.ticket_number || '-'}</div>
          </div>
          <div style="text-align:right">
            <span class="status-badge status-${s.status}" style="font-size:.8rem;padding:.25rem .75rem">${s.status}</span>
            <div style="font-size:.75rem;color:${textMuted};margin-top:.25rem">${formatDate(s.created_at, true)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;padding:.75rem;background:${bgElevated};border-radius:var(--radius)">
          <div><span style="color:${textMuted};font-size:.7rem">VENDEDOR</span><div style="font-weight:600;margin-top:.125rem">${s.user_first_name || ''} ${s.user_last_name || ''}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">CAJA</span><div style="font-weight:600;margin-top:.125rem">#${s.cashbox_id || '-'}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">CLIENTE</span><div style="font-weight:600;margin-top:.125rem">${s.customer_name || s.customer_identifier || '—'}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">DESCUENTO</span><div style="font-weight:600;margin-top:.125rem">${s.discount_percentage ? s.discount_percentage + '%' : '—'} ${s.discount_amount ? '(' + formatCurrency(s.discount_amount) + ')' : ''}</div></div>
        </div>
      </div>

      <div style="border:1px solid ${border};border-radius:var(--radius);overflow:hidden;margin-bottom:1rem">
        <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
          <thead><tr style="background:${bgElevated}">
            <th style="padding:.5rem .75rem;text-align:left;color:${textMuted};font-size:.7rem;font-weight:600">PRODUCTO / CÓDIGO</th>
            <th style="padding:.5rem .75rem;text-align:center;color:${textMuted};font-size:.7rem;font-weight:600">CANT.</th>
            <th style="padding:.5rem .75rem;text-align:right;color:${textMuted};font-size:.7rem;font-weight:600">PRECIO</th>
            <th style="padding:.5rem .75rem;text-align:right;color:${textMuted};font-size:.7rem;font-weight:600">COSTO</th>
            <th style="padding:.5rem .75rem;text-align:right;color:${textMuted};font-size:.7rem;font-weight:600">SUBTOTAL</th>
          </tr></thead>
          <tbody>${items.map(i => {
            const qty = parseFloat(i.quantity) || 0;
            const price = parseFloat(i.unit_price_at_sale) || 0;
            const cost = parseFloat(i.unit_cost_at_sale) || 0;
            const subtotal = qty * price;
            return `<tr style="background:${bgRow}">
              <td style="padding:.5rem .75rem;border-top:1px solid ${border}">
                <div style="font-weight:600">${i.item_name_snapshot || '—'}</div>
                <div style="font-size:.7rem;color:${textMuted};font-family:var(--font-mono)">${i.product_code || '—'}</div>
              </td>
              <td style="padding:.5rem .75rem;text-align:center;border-top:1px solid ${border}">${qty.toFixed(2)}</td>
              <td style="padding:.5rem .75rem;text-align:right;border-top:1px solid ${border}">${formatCurrency(price)}</td>
              <td style="padding:.5rem .75rem;text-align:right;border-top:1px solid ${border};color:${textMuted}">${formatCurrency(cost)}</td>
              <td style="padding:.5rem .75rem;text-align:right;border-top:1px solid ${border};font-weight:700">${formatCurrency(subtotal)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;background:${bgElevated};border-radius:var(--radius);flex-wrap:wrap;gap:.5rem">
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
          <div><span style="color:${textMuted};font-size:.7rem">SUBTOTAL</span><div style="font-size:.875rem">${formatCurrency(s.subtotal || s.total_amount)}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">DESCUENTO</span><div style="font-size:.875rem;color:var(--red)">-${formatCurrency(s.discount_amount || 0)}</div></div>
        </div>
        <div style="text-align:right">
          <span style="color:${textMuted};font-size:.7rem">TOTAL</span>
          <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${formatCurrency(s.total_amount)}</div>
        </div>
      </div>
      <div style="margin-top:.75rem;text-align:center;font-size:.7rem;color:${textMuted}">
        ID: ${s.id} • Creado: ${s.created_at ? new Date(s.created_at).toLocaleString('es-PE') : '—'}
      </div>
    `;
          <div style="text-align:right">
            <span class="status-badge status-${s.status}" style="font-size:.8rem;padding:.25rem .75rem">${s.status}</span>
            <div style="font-size:.75rem;color:${textMuted};margin-top:.25rem">${formatDate(s.created_at, true)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;padding:.75rem;background:${bgElevated};border-radius:var(--radius)">
          <div><span style="color:${textMuted};font-size:.7rem">VENDEDOR</span><div style="font-weight:600;margin-top:.125rem">${s.user_first_name || ''} ${s.user_last_name || ''}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">CAJA</span><div style="font-weight:600;margin-top:.125rem">#${s.cashbox_id || '-'}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">CLIENTE</span><div style="font-weight:600;margin-top:.125rem">${s.customer_name || s.customer_identifier || '—'}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">DESCUENTO</span><div style="font-weight:600;margin-top:.125rem">${s.discount_percentage ? s.discount_percentage + '%' : '—'} ${s.discount_amount ? '(' + formatCurrency(s.discount_amount) + ')' : ''}</div></div>
        </div>
      </div>

      <div style="border:1px solid ${border};border-radius:var(--radius);overflow:hidden;margin-bottom:1rem">
        <table style="width:100%;border-collapse:collapse;font-size:.8125rem">
          <thead><tr style="background:${bgElevated}">
            <th style="padding:.5rem .75rem;text-align:left;color:${textMuted};font-size:.7rem;font-weight:600">PRODUCTO / CÓDIGO</th>
            <th style="padding:.5rem .75rem;text-align:center;color:${textMuted};font-size:.7rem;font-weight:600">CANT.</th>
            <th style="padding:.5rem .75rem;text-align:right;color:${textMuted};font-size:.7rem;font-weight:600">PRECIO</th>
            <th style="padding:.5rem .75rem;text-align:right;color:${textMuted};font-size:.7rem;font-weight:600">COSTO</th>
            <th style="padding:.5rem .75rem;text-align:right;color:${textMuted};font-size:.7rem;font-weight:600">SUBTOTAL</th>
          </tr></thead>
          <tbody>${items.map(i => {
            const qty = parseFloat(i.quantity) || 0;
            const price = parseFloat(i.unit_price_at_sale) || 0;
            const cost = parseFloat(i.unit_cost_at_sale) || 0;
            const subtotal = qty * price;
            return `<tr style="background:${bgRow}">
              <td style="padding:.5rem .75rem;border-top:1px solid ${border}">
                <div style="font-weight:600">${i.item_name_snapshot || '—'}</div>
                <div style="font-size:.7rem;color:${textMuted};font-family:var(--font-mono)">${i.product_code || '—'}</div>
              </td>
              <td style="padding:.5rem .75rem;text-align:center;border-top:1px solid ${border}">${qty.toFixed(2)}</td>
              <td style="padding:.5rem .75rem;text-align:right;border-top:1px solid ${border}">${formatCurrency(price)}</td>
              <td style="padding:.5rem .75rem;text-align:right;border-top:1px solid ${border};color:${textMuted}">${formatCurrency(cost)}</td>
              <td style="padding:.5rem .75rem;text-align:right;border-top:1px solid ${border};font-weight:700">${formatCurrency(subtotal)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem;background:${bgElevated};border-radius:var(--radius);flex-wrap:wrap;gap:.5rem">
        <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
          <div><span style="color:${textMuted};font-size:.7rem">SUBTOTAL</span><div style="font-size:.875rem">${formatCurrency(s.subtotal || s.total_amount)}</div></div>
          <div><span style="color:${textMuted};font-size:.7rem">DESCUENTO</span><div style="font-size:.875rem;color:var(--red)">-${formatCurrency(s.discount_amount || 0)}</div></div>
        </div>
        <div style="text-align:right">
          <span style="color:${textMuted};font-size:.7rem">TOTAL</span>
          <div style="font-size:1.5rem;font-weight:800;color:var(--accent)">${formatCurrency(s.total_amount)}</div>
        </div>
      </div>
      <div style="margin-top:.75rem;text-align:center;font-size:.7rem;color:${textMuted}">
        ID: ${s.id} • Creado: ${s.created_at ? new Date(s.created_at).toLocaleString('es-PE') : '—'}
      </div>
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

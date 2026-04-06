/**
 * Vista Reportes con gráficos
 */
import { ReportService, DashboardService } from '../services/api.js';
import { formatCurrency, formatDate, formatNumber, formatPercent, todayISO, monthStartISO } from '../utils/helpers.js';
import { showLoading, showError, buildTable, Toast } from '../components/ui.js';

let reportCharts = {};

export async function renderReports() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">📈 Reportes</h1><p class="page-subtitle">Análisis de rentabilidad, productos y empleados</p></div>
    </div>
    <div class="filter-bar" style="background:var(--bg-card);padding:1rem;border-radius:var(--radius-lg);margin-bottom:1.5rem;border:1px solid var(--border-light)">
      <div class="form-group">
        <label class="form-label">Fecha Inicio</label>
        <input type="date" class="form-input" id="rep-from" value="${monthStartISO()}">
      </div>
      <div class="form-group">
        <label class="form-label">Fecha Fin</label>
        <input type="date" class="form-input" id="rep-to" value="${todayISO()}">
      </div>
      <button class="btn btn-primary" onclick="window._loadAllReports()">📊 Generar Reportes</button>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="products" onclick="window._reportTab('products')">🌺 Productos</button>
      <button class="tab-btn" data-tab="employees" onclick="window._reportTab('employees')">👥 Empleados</button>
      <button class="tab-btn" data-tab="payments" onclick="window._reportTab('payments')">💳 Pagos</button>
    </div>
    <div id="report-content"></div>
  `;

  window._reportTab = (t) => switchReportTab(t);
  window._loadAllReports = () => switchReportTab(getCurrentReportTab());
  switchReportTab('products');
}

let _currentReportTab = 'products';
function getCurrentReportTab() { return _currentReportTab; }

function switchReportTab(tab) {
  _currentReportTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  Object.values(reportCharts).forEach(c => c?.destroy());
  reportCharts = {};
  switch (tab) {
    case 'products': loadProductPerformance(); break;
    case 'employees': loadEmployeeReport(); break;
    case 'payments': loadPaymentReport(); break;
  }
}

function getDateParams() {
  return {
    start_date: document.getElementById('rep-from')?.value || monthStartISO(),
    end_date: document.getElementById('rep-to')?.value || todayISO(),
  };
}

async function loadProductPerformance() {
  const content = document.getElementById('report-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await ReportService.getProductPerformance({ ...getDateParams(), limit: 20 });

    // Backend returns: { summary: { period, totals }, top_sellers: [...], bottom_sellers: [...], category_performance: [...], alerts: [...] }
    const d = res.data || {};
    const totals         = d.summary?.totals  || {};
    const topSellers     = d.top_sellers       || [];
    const categoryPerf   = d.category_performance || [];
    const alerts         = d.alerts            || [];

    // Normalize top_sellers for table & charts
    const products = topSellers.map(item => ({
      product_name:   item.product_name,
      category_name:  item.category_name,
      units_sold:     parseFloat(item.units_sold)     || 0,
      revenue:        parseFloat(item.total_revenue)  || 0,
      avg_price:      parseFloat(item.average_price)  || 0,
      profit_margin:  parseFloat(item.profit_margin)  || 0,
      transactions:   parseInt(item.transactions_count) || 0,
      current_stock:  parseInt(item.current_stock)    || 0,
    }));

    // Build alerts HTML
    const alertsHtml = alerts.length ? `
      <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.5rem">
        ${alerts.map(a => `
          <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem 1rem;border-radius:var(--radius-md);background:${a.type === 'no_sales' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)'};border:1px solid ${a.type === 'no_sales' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}">
            <span>${a.type === 'no_sales' ? '🚨' : '⚠️'}</span>
            <span style="font-size:.875rem;color:var(--text-secondary)">${a.message}</span>
            <span style="margin-left:auto;font-size:.8125rem;font-weight:600;color:${a.type === 'no_sales' ? 'var(--red)' : 'var(--yellow)'}">
              ${a.products.map(p => p.product_name).join(', ')}
            </span>
          </div>
        `).join('')}
      </div>` : '';

    content.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:1.5rem">
        <div class="kpi-card accent"><span class="kpi-icon">📦</span><div class="kpi-value">${formatNumber(totals.total_units_sold || 0)}</div><div class="kpi-label">Unidades Vendidas</div></div>
        <div class="kpi-card green"><span class="kpi-icon">💰</span><div class="kpi-value">${formatCurrency(totals.total_revenue || 0)}</div><div class="kpi-label">Ingresos Totales</div></div>
        <div class="kpi-card blue"><span class="kpi-icon">🧾</span><div class="kpi-value">${formatNumber(totals.total_transactions || 0)}</div><div class="kpi-label">Transacciones</div></div>
        <div class="kpi-card"><span class="kpi-icon">🏷️</span><div class="kpi-value">${formatCurrency(totals.average_price_per_unit || 0)}</div><div class="kpi-label">Precio Promedio</div></div>
      </div>

      ${alertsHtml}

      <div class="chart-grid chart-grid-2" style="margin-bottom:1.5rem">
        <div class="card">
          <div class="card-header"><span class="card-title">Top Productos — Unidades Vendidas</span></div>
          <div class="chart-container"><canvas id="chart-prod-units"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Rendimiento por Categoría</span></div>
          <div class="chart-container"><canvas id="chart-cat-revenue"></canvas></div>
        </div>
      </div>

      <div class="card" style="padding:0;margin-bottom:1.5rem">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)"><span class="card-title">Rendimiento de Productos</span></div>
        ${buildTable(
          [
            { key: 'product_name',  label: 'Producto' },
            { key: 'category_name', label: 'Categoría' },
            { key: 'units_sold',    label: 'Unidades',    render: (v) => `<span style="font-family:var(--font-mono)">${formatNumber(v)}</span>` },
            { key: 'revenue',       label: 'Ingresos',    render: (v) => `<span style="color:var(--accent);font-weight:700">${formatCurrency(v)}</span>` },
            { key: 'avg_price',     label: 'Precio Prom.',render: (v) => `<span style="font-family:var(--font-mono)">${formatCurrency(v)}</span>` },
            { key: 'profit_margin', label: 'Margen',      render: (v) => `<span style="color:var(--green)">${formatPercent(v)}</span>` },
            { key: 'transactions',  label: 'Transacciones',render: (v) => `<span style="font-family:var(--font-mono)">${formatNumber(v)}</span>` },
            { key: 'current_stock', label: 'Stock',       render: (v) => `<span style="font-family:var(--font-mono);color:${v < 20 ? 'var(--red)' : 'var(--text-secondary)'}">${formatNumber(v)}</span>` },
          ],
          products, { emptyMsg: 'Sin datos de productos' }
        )}
      </div>
    `;

    // Chart: top products by units sold
    if (products.length) {
      reportCharts.prodUnits = new Chart(document.getElementById('chart-prod-units'), {
        type: 'bar',
        data: {
          labels: products.map(p => (p.product_name || '').slice(0, 15)),
          datasets: [{ label: 'Unidades', data: products.map(p => p.units_sold), backgroundColor: 'rgba(96,165,250,.7)', borderRadius: 4 }]
        },
        options: { ...chartOpts(), indexAxis: 'y' }
      });
    }

    // Chart: category revenue (doughnut)
    if (categoryPerf.length) {
      reportCharts.catRev = new Chart(document.getElementById('chart-cat-revenue'), {
        type: 'doughnut',
        data: {
          labels: categoryPerf.map(c => c.category_name),
          datasets: [{
            data: categoryPerf.map(c => parseFloat(c.total_revenue) || 0),
            backgroundColor: ['#e8876a','#10b981','#60a5fa','#a78bfa','#f59e0b','#ef4444'],
            borderWidth: 2, borderColor: '#1a2032',
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } }
          },
          cutout: '55%'
        }
      });
    }
  } catch (err) { showError(content, err.message); }
}

async function loadEmployeeReport() {
  const content = document.getElementById('report-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await ReportService.getEmployee(getDateParams());
    
    // Handle both object and array responses
    let data;
    if (Array.isArray(res.data)) {
      data = res.data;
    } else if (res.data && typeof res.data === 'object') {
      // Backend returns: { by_employee: [...], summary: {...} }
      data = res.data.by_employee || res.data.employees || res.data.items || [];
    } else {
      data = [];
    }

    // Normalize data fields - backend uses different names and types
    data = data.map(item => ({
      // Backend uses first_name + last_name, frontend expects employee_name
      employee_name: `${item.first_name} ${item.last_name}`,
      // Backend uses transaction_count, frontend expects transactions
      transactions: parseInt(item.transaction_count) || 0,
      // Backend uses total_amount, frontend expects total_sales
      total_sales: parseFloat(item.total_amount) || 0,
    }));
    content.innerHTML = `
      <div class="chart-grid chart-grid-2" style="margin-bottom:1.5rem">
        <div class="card">
          <div class="card-header"><span class="card-title">Ventas por Empleado</span></div>
          <div class="chart-container"><canvas id="chart-emp-sales"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Transacciones por Empleado</span></div>
          <div class="chart-container"><canvas id="chart-emp-txn"></canvas></div>
        </div>
      </div>
      <div class="card" style="padding:0">
        ${buildTable(
          [
            { key: 'employee_name', label: 'Empleado' },
            { key: 'total_sales', label: 'Total Ventas', render: (v) => `<span style="color:var(--accent);font-weight:700">${formatCurrency(v)}</span>` },
            { key: 'transactions', label: 'Transacciones', render: (v) => `<span style="font-family:var(--font-mono)">${formatNumber(v)}</span>` },
          ], data, { emptyMsg: 'Sin datos de empleados' }
        )}
      </div>
    `;
    if (data.length) {
      reportCharts.empSales = new Chart(document.getElementById('chart-emp-sales'), {
        type: 'bar',
        data: { labels: data.map(e => e.employee_name), datasets: [{ label: 'Ventas', data: data.map(e => e.total_sales), backgroundColor: 'rgba(139,92,246,.7)', borderRadius: 4 }] },
        options: chartOpts({ yFormatter: (v) => `S/ ${(v/1000).toFixed(0)}k` })
      });
      reportCharts.empTxn = new Chart(document.getElementById('chart-emp-txn'), {
        type: 'doughnut',
        data: { labels: data.map(e => e.employee_name), datasets: [{ data: data.map(e => e.transactions), backgroundColor: ['#e8876a','#10b981','#60a5fa','#a78bfa','#f59e0b'], borderWidth: 2, borderColor: '#1a2032' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } }, cutout: '50%' }
      });
    }
  } catch (err) { showError(content, err.message); }
}

async function loadPaymentReport() {
  const content = document.getElementById('report-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await ReportService.getPaymentMethod(getDateParams());
    const resData = res.data || {};
    
    // Backend returns: { by_payment_method: [...], summary: {...} }
    // Need to transform into { cash: amount, yape: amount, ... }
    const byPaymentMethod = resData.by_payment_method || [];
    const data = {};
    
    byPaymentMethod.forEach(item => {
      const method = item.payment_method;
      data[method] = parseFloat(item.total_amount) || 0;
    });
    
    const labels = { cash: 'Efectivo', yape: 'Yape', card: 'Tarjeta', transfer: 'Transferencia', plin: 'Plin' };
    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    content.innerHTML = `
      <div class="chart-grid chart-grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">Distribución por Método de Pago</span></div>
          <div class="chart-container"><canvas id="chart-payment-dist"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Detalle</span></div>
          <div style="display:flex;flex-direction:column;gap:.75rem;padding:.25rem 0">
            ${entries.map(([k, v]) => `
              <div style="display:flex;align-items:center;gap:.75rem">
                <span style="font-weight:600;min-width:120px">${labels[k] || k}</span>
                <div style="flex:1;height:8px;background:var(--bg-base);border-radius:4px;overflow:hidden">
                  <div style="height:100%;background:var(--accent);border-radius:4px;width:${total > 0 ? (v/total*100).toFixed(0) : 0}%"></div>
                </div>
                <span style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">${formatCurrency(v)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    const ctx = document.getElementById('chart-payment-dist');
    if (ctx && entries.length) {
      reportCharts.payment = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: entries.map(([k]) => labels[k] || k),
          datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#10b981','#60a5fa','#a78bfa','#f59e0b','#ef4444'], borderWidth: 2, borderColor: '#1a2032' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } } }, cutout: '60%' }
      });
    }
  } catch (err) { showError(content, err.message); }
}

function chartOpts({ yFormatter = (v) => v } = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } }, tooltip: { backgroundColor: '#1e2434', borderColor: '#2a3254', borderWidth: 1, titleColor: '#f0f4ff', bodyColor: '#94a3b8' } },
    scales: { x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1f2a45' } }, y: { ticks: { color: '#64748b', font: { size: 10 }, callback: yFormatter }, grid: { color: '#1f2a45' } } }
  };
}

/**
 * Vista Dashboard Principal
 */
import { DashboardService } from '../services/api.js';
import { formatCurrency, formatNumber } from '../utils/helpers.js';
import { showLoading, showError } from '../components/ui.js';
import Store from '../utils/store.js';

let charts = {};

export async function renderDashboard() {
  const main = document.getElementById('main-content');
  showLoading(main, 'Cargando dashboard...');

  try {
    const [dashRes, monthlyRes] = await Promise.allSettled([
      DashboardService.getAll(),
      DashboardService.getMonthlySales(),
    ]);

    const dash = dashRes.status === 'fulfilled' ? dashRes.value.data : null;
    const monthly = monthlyRes.status === 'fulfilled' ? monthlyRes.value.data : null;

    main.innerHTML = buildDashboardHTML(dash);

    Object.values(charts).forEach(c => c?.destroy());
    charts = {};

    if (dash) {
      renderSalesChart(dash, monthly);
      renderPaymentChart(dash);
      renderLowStockChart(dash);
    }

  } catch (err) {
    showError(main, err.message);
  }
}

function buildDashboardHTML(dash) {
  const d = dash || {};
  const dailySales = d.daily_sales?.today || {};
  const monthlySales = d.monthly_sales?.current_month || {};
  const growth = d.monthly_sales?.growth_percentage || 0;
  const lowStockCount = d.low_stock_products?.length || 0;
  const user = Store.get('user');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return `
    <div class="dash-hero">
      <div class="dash-hero-text">
        <h1 class="dash-greeting">${greeting}, ${user?.first_name || 'Usuario'} 👋</h1>
        <p class="dash-date">${new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>
      <button class="btn btn-secondary btn-sm dash-refresh-btn" onclick="import('./views/dashboard.view.js').then(m=>m.renderDashboard())">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Actualizar
      </button>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid kpi-grid-3">
      <div class="kpi-card accent">
        <div class="kpi-card-inner">
          <div class="kpi-icon-wrap accent">💰</div>
          <div>
            <div class="kpi-value" id="kpi-today">${formatCurrency(dailySales.total)}</div>
            <div class="kpi-label">Ventas Hoy</div>
            <div class="kpi-delta up">🧾 ${formatNumber(dailySales.transactions || 0)} transacciones</div>
          </div>
        </div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-card-inner">
          <div class="kpi-icon-wrap green">📈</div>
          <div>
            <div class="kpi-value">${formatCurrency(monthlySales.total)}</div>
            <div class="kpi-label">Ventas del Mes</div>
            <div class="kpi-delta ${growth >= 0 ? 'up' : 'down'}">${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}% vs mes anterior</div>
          </div>
        </div>
      </div>
      <div class="kpi-card ${lowStockCount > 0 ? 'red' : 'purple'}">
        <div class="kpi-card-inner">
          <div class="kpi-icon-wrap ${lowStockCount > 0 ? 'red' : 'purple'}">📦</div>
          <div>
            <div class="kpi-value">${lowStockCount}</div>
            <div class="kpi-label">Bajo Stock</div>
            ${lowStockCount > 0
              ? `<div class="kpi-delta down">⚠️ Requieren reposición</div>`
              : `<div class="kpi-delta up">✓ Stock saludable</div>`}
          </div>
        </div>
      </div>
    </div>

    <!-- CHARTS ROW 1 -->
    <div class="dash-grid-main">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Ventas Mensuales</span>
          <span class="card-subtitle">Últimos meses</span>
        </div>
        <div class="chart-container"><canvas id="chart-monthly-sales"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Método de Pago</span>
        </div>
        <div class="chart-container"><canvas id="chart-payment"></canvas></div>
      </div>
    </div>

    <!-- CHARTS ROW 2 -->
    <div class="dash-grid-secondary">
      <div class="card">
        <div class="card-header">
          <span class="card-title">🏆 Top Productos</span>
          <a href="#/reports" class="btn btn-ghost btn-sm">Ver reportes →</a>
        </div>
        <div id="top-sellers-list">${renderTopSellersList(d.top_sellers)}</div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">⚠️ Stock Bajo</span>
          <a href="#/inventory" class="btn btn-warning btn-sm">Gestionar →</a>
        </div>
        <div class="chart-container" style="height:200px"><canvas id="chart-low-stock"></canvas></div>
      </div>
    </div>
  `;
}

function renderTopSellersList(topSellers) {
  if (!topSellers?.length) {
    return '<div class="empty-state" style="padding:1.5rem">Sin datos de ventas</div>';
  }
  const medals = ['🥇','🥈','🥉'];
  return `<div class="top-sellers">
    ${topSellers.slice(0, 5).map((p, i) => `
      <div class="top-seller-row">
        <span class="top-seller-rank">${medals[i] || i + 1}</span>
        <div class="top-seller-info">
          <div class="top-seller-name">${p.name || p.product_name}</div>
          <div class="top-seller-units">${formatNumber(p.units_sold)} uds</div>
        </div>
        <div class="top-seller-revenue">${formatCurrency(p.total_revenue || p.revenue)}</div>
      </div>
    `).join('')}
  </div>`;
}

function renderSalesChart(dash, monthly) {
  const ctx = document.getElementById('chart-monthly-sales');
  if (!ctx) return;

  let byMonth = [];
  if (monthly?.monthly_data) byMonth = monthly.monthly_data;
  else if (Array.isArray(monthly?.data)) byMonth = monthly.data;
  else if (Array.isArray(monthly)) byMonth = monthly;
  else if (dash.monthly_sales?.monthly_data) byMonth = dash.monthly_sales.monthly_data;

  if (!byMonth.length) {
    const cur = dash?.monthly_sales?.current_month;
    const prev = dash?.monthly_sales?.last_month;
    const fmt = (offset) => new Date(new Date().setMonth(new Date().getMonth() + offset))
      .toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
    byMonth = [
      { month: fmt(-1), total: prev?.total || 0 },
      { month: fmt(0),  total: cur?.total  || 0 },
    ];
  }

  charts.monthly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: byMonth.map(m => m.month || m.label),
      datasets: [{
        label: 'Ingresos',
        data: byMonth.map(m => m.total || m.revenue || 0),
        borderColor: '#e8876a',
        backgroundColor: 'rgba(232,135,106,.12)',
        fill: true,
        tension: .4,
        pointBackgroundColor: '#e8876a',
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: chartDefaults({ yFormatter: (v) => `S/ ${(v/1000).toFixed(1)}k` })
  });
}

function renderPaymentChart(dash) {
  const ctx = document.getElementById('chart-payment');
  if (!ctx) return;

  const paymentData = dash.payment_summary || {};
  const labels = { cash: 'Efectivo', yape: 'Yape', card: 'Tarjeta', transfer: 'Transferencia', plin: 'Plin' };
  const entries = Object.entries(paymentData).filter(([, v]) => v > 0);

  if (!entries.length) {
    ctx.parentElement.innerHTML = '<div class="empty-state" style="padding:1.5rem">Sin datos de pagos</div>';
    return;
  }

  charts.payment = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => labels[k] || k),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: ['#10b981','#60a5fa','#a78bfa','#f59e0b','#ef4444'],
        borderWidth: 2,
        borderColor: '#1a2032',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 14 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } }
      },
      cutout: '68%',
    }
  });
}

function renderLowStockChart(dash) {
  const ctx = document.getElementById('chart-low-stock');
  if (!ctx) return;

  const products = (dash.low_stock_products || []).slice(0, 6);
  if (!products.length) {
    ctx.parentElement.innerHTML = '<div class="empty-state" style="padding:1.5rem">✅ Sin productos con stock bajo</div>';
    return;
  }

  charts.lowstock = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: products.map(p => p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name),
      datasets: [
        {
          label: 'Stock actual',
          data: products.map(p => p.stock_cached),
          backgroundColor: '#ef444480',
          borderColor: '#ef4444',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Stock mínimo',
          data: products.map(p => p.min_stock),
          backgroundColor: '#f59e0b30',
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: chartDefaults({ yFormatter: (v) => v })
  });
}

function chartDefaults({ yFormatter = (v) => v } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1e2434',
        borderColor: '#2a3254',
        borderWidth: 1,
        titleColor: '#f0f4ff',
        bodyColor: '#94a3b8',
        padding: 10,
      }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1f2a4520' } },
      y: {
        ticks: { color: '#64748b', font: { size: 10 }, callback: yFormatter },
        grid: { color: '#1f2a4520' }
      }
    }
  };
}



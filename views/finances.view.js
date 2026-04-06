/**
 * Vista Finanzas — Diseño mejorado + Capital de Trabajo
 */
import { FinanceService } from '../services/api.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import { Toast, showModal, closeModal, confirm, buildTable, showLoading, showError } from '../components/ui.js';
import { buildForm, attachFormHandlers } from '../components/form.js';
import Store from '../utils/store.js';

let financeCharts = {};

export async function renderFinances() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💳 Finanzas</h1>
        <p class="page-subtitle">Control de gastos, egresos y capital de trabajo</p>
      </div>
      <button class="btn btn-primary" onclick="window._financeCreate()">+ Registrar Gasto</button>
    </div>

    <div class="fin-tabs">
      <button class="fin-tab-btn active" data-tab="expenses" onclick="window._financeTab('expenses')">
        <span class="fin-tab-icon">💸</span> Gastos
      </button>
      <button class="fin-tab-btn" data-tab="capital" onclick="window._financeTab('capital')">
        <span class="fin-tab-icon">📊</span> Capital de Trabajo
      </button>
      <button class="fin-tab-btn" data-tab="charts" onclick="window._financeTab('charts')">
        <span class="fin-tab-icon">📈</span> Gráficos
      </button>
      <button class="fin-tab-btn" data-tab="daily" onclick="window._financeTab('daily')">
        <span class="fin-tab-icon">📅</span> Historial Diario
      </button>
    </div>

    <div id="finance-content"></div>
  `;

  window._financeTab    = (t) => switchFinanceTab(t);
  window._financeCreate = () => openFinanceForm(null);
  window._financeEdit   = (id) => openFinanceForm(id);
  window._financeDelete = (id) => deleteFinance(id);

  switchFinanceTab('expenses');
}

function switchFinanceTab(tab) {
  document.querySelectorAll('.fin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  switch (tab) {
    case 'expenses': loadExpenses();       break;
    case 'capital':  loadWorkingCapital(); break;
    case 'charts':   loadFinanceCharts(); break;
    case 'daily':    loadDailyExpenses(); break;
  }
}

/* ══════════════════════════════════════════════════════
   TAB: GASTOS
══════════════════════════════════════════════════════ */
async function loadExpenses() {
  const content = document.getElementById('finance-content');
  content.innerHTML = `
    <div class="fin-filter-bar">
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-input" id="fin-cat" onchange="window._financeLoadExpenses()">
          <option value="">Todas</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Desde</label>
        <input type="date" class="form-input" id="fin-from" onchange="window._financeLoadExpenses()">
      </div>
      <div class="form-group">
        <label class="form-label">Hasta</label>
        <input type="date" class="form-input" id="fin-to" onchange="window._financeLoadExpenses()">
      </div>
    </div>
    <div class="card" style="padding:0">
      <div id="finance-table"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;

  window._financeLoadExpenses = loadExpensesData;

  try {
    const res = await FinanceService.getCategories();
    const select = document.getElementById('fin-cat');
    (res.data || []).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat.replace(/_/g, ' ');
      select.appendChild(opt);
    });
  } catch {}

  await loadExpensesData();
}

async function loadExpensesData() {
  const container = document.getElementById('finance-table');
  if (!container) return;
  showLoading(container);
  try {
    const params = {};
    const c = document.getElementById('fin-cat')?.value;
    const f = document.getElementById('fin-from')?.value;
    const t = document.getElementById('fin-to')?.value;
    if (c) params.category = c;
    if (f) params.start_date = f;
    if (t) params.end_date = t;

    const res = await FinanceService.getAll({ ...params, limit: 100 });
    const columns = [
      { key: 'date', label: 'Fecha', render: (v) => `<span style="font-size:.8125rem;color:var(--text-muted)">${v}</span>` },
      { key: 'description', label: 'Descripción' },
      { key: 'category', label: 'Categoría', render: (v) => `<span class="fin-cat-badge">${v?.replace(/_/g, ' ')}</span>` },
      { key: 'payment_method', label: 'Método', render: (v) => v ? `<span class="fin-method-badge">${v}</span>` : '—' },
      { key: 'amount', label: 'Monto', render: (v) => `<span class="fin-amount-neg">${formatCurrency(v)}</span>` },
    ];
    container.innerHTML = buildTable(columns, res.data || [], {
      emptyMsg: 'Sin gastos registrados',
      actions: (row) => `
        <div style="display:flex;gap:.375rem">
          <button class="btn btn-sm btn-ghost btn-icon" onclick="window._financeEdit(${row.id})">✏️</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="window._financeDelete(${row.id})">🗑</button>
        </div>
      `
    });
  } catch (err) { showError(container, err.message); }
}

/* ══════════════════════════════════════════════════════
   TAB: CAPITAL DE TRABAJO
══════════════════════════════════════════════════════ */
async function loadWorkingCapital() {
  const content = document.getElementById('finance-content');
  content.innerHTML = `
    <div class="wc-date-bar">
      <div class="form-group">
        <label class="form-label">Período inicio</label>
        <input type="date" class="form-input" id="wc-from">
      </div>
      <div class="form-group">
        <label class="form-label">Período fin</label>
        <input type="date" class="form-input" id="wc-to">
      </div>
      <button class="btn btn-secondary btn-sm" onclick="window._wcRefresh()">🔄 Actualizar</button>
    </div>
    <div id="wc-content"><div class="page-loading"><div class="spinner"></div></div></div>
  `;

  const today = new Date();
  const past  = new Date(today); past.setDate(past.getDate() - 30);
  document.getElementById('wc-from').value = past.toISOString().split('T')[0];
  document.getElementById('wc-to').value   = today.toISOString().split('T')[0];

  window._wcRefresh      = loadWorkingCapitalData;
  window._wcSaveConfig   = saveCapitalConfig;

  await loadWorkingCapitalData();
}

async function loadWorkingCapitalData() {
  const container = document.getElementById('wc-content');
  if (!container) return;
  showLoading(container);

  try {
    const from = document.getElementById('wc-from')?.value;
    const to   = document.getElementById('wc-to')?.value;
    const params = {};
    if (from) params.start_date = from;
    if (to)   params.end_date   = to;

    // Llamadas paralelas a todos los endpoints del README
    const [wcRes, invRes, wasteRes, cashRes, configRes] = await Promise.allSettled([
      FinanceService.getWorkingCapital(params),
      FinanceService.getInventoryValue(),
      FinanceService.getWasteValue(params),
      FinanceService.getCashInBoxes(params),
      FinanceService.getCapitalConfig(),
    ]);

    console.log('[DEBUG WC] wcRes:', wcRes);
    console.log('[DEBUG WC] configRes:', configRes);

    const d      = wcRes.status === 'fulfilled' ? wcRes.value.data || {}   : {};
    const comp   = d.components || {};
    const period = d.period     || {};

    // Valores del endpoint principal
    const wc       = parseFloat(d.working_capital      || 0);
    const gross    = parseFloat(comp.inventory_gross   || 0);
    const waste    = parseFloat(comp.waste_deductions  || 0);
    const inv      = parseFloat(comp.inventory_net     || 0);
    const cash     = parseFloat(comp.cash_in_boxes     || 0);
    const expenses = parseFloat(comp.total_expenses    || 0);

    // Valores de los endpoints independientes (para validación cruzada)
    const invIndep   = invRes.status   === 'fulfilled' ? parseFloat(invRes.value.data?.inventory_value || 0) : null;
    const wasteIndep = wasteRes.status === 'fulfilled' ? parseFloat(wasteRes.value.data?.waste_value   || 0) : null;
    const cashIndep  = cashRes.status  === 'fulfilled' ? parseFloat(cashRes.value.data?.cash_in_boxes  || 0) : null;
    const config     = configRes.status === 'fulfilled' ? configRes.value.data || {} : null;

    const statusMap = {
      solid:    { text: 'var(--green)',  icon: '🟢', label: d.status_label || 'Sólido',      cond: 'Capital > 100% de gastos',            chip: 'wc-chip-green'  },
      warning:  { text: 'var(--yellow)', icon: '🟡', label: d.status_label || 'Advertencia', cond: 'Capital entre 30% y 100% de gastos',  chip: 'wc-chip-yellow' },
      low:      { text: '#f97316',       icon: '🟠', label: d.status_label || 'Bajo',         cond: 'Capital < 30% de gastos',             chip: 'wc-chip-orange' },
      critical: { text: 'var(--red)',    icon: '🔴', label: d.status_label || 'Crítico',      cond: 'Capital ≤ 0',                         chip: 'wc-chip-red'    },
    };
    const sc = statusMap[d.status] || statusMap.warning;

    const total   = Math.max(gross + cash, 1);
    const invPct  = Math.min(Math.round((inv      / total) * 100), 100);
    const cashPct = Math.min(Math.round((cash     / total) * 100), 100);
    const expPct  = Math.min(Math.round((expenses / total) * 100), 100);
    const wstPct  = Math.min(Math.round((waste    / total) * 100), 100);

    const fmt = formatCurrency;
    const periodStr = period.start_date && period.end_date
      ? `${period.start_date.split('T')[0]} → ${period.end_date.split('T')[0]}`
      : 'Últimos 30 días';

    // Helpers para mostrar fuente independiente si difiere significativamente
    const indepTag = (indep, fromComp) => {
      if (indep === null) return '';
      const diff = Math.abs(indep - fromComp);
      if (diff < 0.01) return '';
      return `<span class="wc-indep-note" title="Valor del endpoint independiente">${fmt(indep)}</span>`;
    };

    // Sección de config (solo si cargó)
    const configSection = config ? `
      <div class="card wc-config-card" style="margin-top:1rem">
        <div class="card-header">
          <span class="card-title">⚙️ Configuración de Capital Inicial</span>
          <span class="wc-config-source-badge">fuente: ${config.source || 'environment'}</span>
        </div>
        <div class="wc-config-body">
          <div class="wc-config-row">
            <div>
              <div class="wc-config-label">Capital inicial configurado</div>
              <div class="wc-config-value">${config.has_initial_capital ? fmt(config.initial_capital) : '—'}</div>
              <div class="wc-config-hint">Definido en variable de entorno <code>INITIAL_WORKING_CAPITAL</code></div>
            </div>
            <div class="wc-config-edit">
              <input type="number" class="form-input wc-config-input" id="wc-initial-capital"
                placeholder="Ej: 10000.00" step="0.01" min="0.01"
                value="${config.has_initial_capital ? config.initial_capital : ''}">
              <button class="btn btn-primary btn-sm" onclick="window._wcSaveConfig()">Guardar</button>
            </div>
          </div>
          ${config.requires_restart ? `
            <div class="wc-config-warning">
              ⚠️ El cambio requiere reinicio del servidor para aplicarse
            </div>
          ` : ''}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <!-- ── Hero ─────────────────────────────────────────── -->
      <div class="wc-hero" style="--wc-color:${sc.text}">
        <div class="wc-hero-left">
          <div class="wc-hero-label">Capital de Trabajo</div>
          <div class="wc-hero-value">${fmt(wc)}</div>
          <div class="wc-hero-period">📅 ${periodStr}</div>
          <div class="wc-status-pill" style="background:${sc.text}18;color:${sc.text};border:1px solid ${sc.text}35">
            ${sc.icon} ${sc.label}
          </div>
          <div class="wc-status-desc">${getStatusDescription(d.status)}</div>
        </div>
        <div class="wc-formula-box">
          <div class="wc-formula-title">( Inventario − Mermas ) + Efectivo en Cajas − Gastos</div>
          <div class="wc-formula-line">
            <span class="wc-f-label">Inventario bruto</span>
            <span class="wc-f-value">${fmt(gross)} ${indepTag(invIndep, gross)}</span>
          </div>
          <div class="wc-formula-line wc-formula-sub">
            <span class="wc-f-label">− Mermas del período</span>
            <span class="wc-f-value" style="color:var(--red)">− ${fmt(waste)} ${indepTag(wasteIndep, waste)}</span>
          </div>
          <div class="wc-formula-line wc-formula-result-row">
            <span class="wc-f-label">= Inventario neto</span>
            <span class="wc-f-value" style="color:var(--blue)">${fmt(inv)}</span>
          </div>
          <div class="wc-formula-line">
            <span class="wc-f-label">+ Efectivo en cajas cerradas</span>
            <span class="wc-f-value" style="color:var(--green)">+ ${fmt(cash)} ${indepTag(cashIndep, cash)}</span>
          </div>
          <div class="wc-formula-line wc-formula-sub">
            <span class="wc-f-label">− Gastos del período</span>
            <span class="wc-f-value" style="color:var(--red)">− ${fmt(expenses)}</span>
          </div>
          <div class="wc-formula-divider"></div>
          <div class="wc-formula-line wc-formula-total">
            <span class="wc-f-label" style="color:var(--text-primary)">=  Capital de Trabajo</span>
            <span class="wc-f-value" style="color:${sc.text};font-size:1.0625rem">${fmt(wc)}</span>
          </div>
        </div>
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────── -->
      <div class="kpi-grid" style="margin-top:1.25rem">
        <div class="kpi-card blue">
          <span class="kpi-icon">📦</span>
          <div class="kpi-value">${fmt(inv)}</div>
          <div class="kpi-label">Inventario Neto</div>
          <div class="wc-kpi-detail">${fmt(gross)} bruto − ${fmt(waste)} mermas</div>
          <div class="wc-bar-wrap">
            <div class="wc-bar-bg"><div class="wc-bar-fill" style="width:${invPct}%;background:var(--blue)"></div></div>
            <span class="wc-bar-pct">${invPct}%</span>
          </div>
        </div>
        <div class="kpi-card green">
          <span class="kpi-icon">🏦</span>
          <div class="kpi-value">${fmt(cash)}</div>
          <div class="kpi-label">Efectivo en Cajas</div>
          <div class="wc-kpi-detail">Suma de cierres de caja</div>
          <div class="wc-bar-wrap">
            <div class="wc-bar-bg"><div class="wc-bar-fill" style="width:${cashPct}%;background:var(--green)"></div></div>
            <span class="wc-bar-pct">${cashPct}%</span>
          </div>
        </div>
        <div class="kpi-card red">
          <span class="kpi-icon">💸</span>
          <div class="kpi-value">${fmt(expenses)}</div>
          <div class="kpi-label">Gastos del Período</div>
          <div class="wc-kpi-detail">Egresos registrados</div>
          <div class="wc-bar-wrap">
            <div class="wc-bar-bg"><div class="wc-bar-fill" style="width:${expPct}%;background:var(--red)"></div></div>
            <span class="wc-bar-pct">${expPct}%</span>
          </div>
        </div>
        <div class="kpi-card yellow">
          <span class="kpi-icon">🗑️</span>
          <div class="kpi-value">${fmt(waste)}</div>
          <div class="kpi-label">Mermas Descontadas</div>
          <div class="wc-kpi-detail">Movimientos tipo waste</div>
          <div class="wc-bar-wrap">
            <div class="wc-bar-bg"><div class="wc-bar-fill" style="width:${wstPct}%;background:var(--yellow)"></div></div>
            <span class="wc-bar-pct">${wstPct}%</span>
          </div>
        </div>
      </div>

      <!-- ── Tabla de estados ───────────────────────────────── -->
      <div class="card" style="margin-top:1rem;padding:0">
        <div class="card-header" style="padding:1rem 1.25rem">
          <span class="card-title">📋 Estados posibles</span>
        </div>
        <div class="wc-states-table">
          ${Object.entries(statusMap).map(([key, s]) => `
            <div class="wc-state-row ${d.status === key ? 'wc-state-active' : ''}">
              <span class="wc-state-dot" style="background:${s.text}"></span>
              <span class="wc-state-name">${s.label}</span>
              <span class="wc-state-cond">${s.cond}</span>
              <span class="wc-state-chip ${s.chip}">${d.status === key ? 'Estado actual' : s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ── Configuración de Capital Inicial (admin) ───────── -->
      ${configSection}
    `;

    // Animar barras
    requestAnimationFrame(() => {
      document.querySelectorAll('.wc-bar-fill').forEach(b => {
        const w = b.style.width;
        b.style.width = '0%';
        setTimeout(() => { b.style.width = w; }, 100);
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div class="wc-error-state">
        <div style="font-size:2.5rem">⚠️</div>
        <div style="font-weight:600;margin-top:.5rem">No se pudo cargar el Capital de Trabajo</div>
        <div style="color:var(--text-muted);font-size:.875rem;margin-top:.25rem">${err.message}</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:1rem" onclick="window._wcRefresh()">Reintentar</button>
      </div>
    `;
  }
}

async function saveCapitalConfig() {
  const input = document.getElementById('wc-initial-capital');
  const val   = parseFloat(input?.value);
  if (!val || val <= 0) { Toast.error('Ingresa un capital inicial válido mayor a 0'); return; }
  try {
    await FinanceService.updateCapitalConfig({ initial_capital: val });
    Toast.success('Capital inicial actualizado. Reinicia el servidor para aplicar el cambio.');
    await loadWorkingCapitalData();
  } catch (err) { Toast.error(err.message); }
}

function getStatusDescription(status) {
  switch (status) {
    case 'solid':    return 'Capital suficiente para operar con holgura. Buen momento para inversiones o expansión.';
    case 'warning':  return 'El capital cubre los gastos con margen reducido. Se recomienda monitorear de cerca.';
    case 'low':      return 'Capital insuficiente frente a los gastos. Revisar egresos y buscar aumentar ingresos.';
    case 'critical': return 'Capital negativo: los gastos superan todos los activos. Acción inmediata requerida.';
    default:         return 'Analiza los componentes para evaluar la situación financiera actual.';
  }
}

/* ══════════════════════════════════════════════════════
   TAB: GRÁFICOS
══════════════════════════════════════════════════════ */
async function loadFinanceCharts() {
  const content = document.getElementById('finance-content');
  content.innerHTML = `
    <div class="chart-grid chart-grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Gastos por Categoría</span></div>
        <div class="chart-container"><canvas id="chart-fin-cat"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Gastos Diarios (Últimos 30 días)</span></div>
        <div id="daily-fin-list" style="max-height:260px;overflow-y:auto"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>
  `;

  Object.values(financeCharts).forEach(c => c?.destroy());
  financeCharts = {};

  try {
    const [summaryRes, dailyRes] = await Promise.all([
      FinanceService.getSummaryByCategory(),
      FinanceService.getDaily(),
    ]);

    const summary = summaryRes.data || {};
    const daily = dailyRes.data || [];

    const catCtx = document.getElementById('chart-fin-cat');
    if (catCtx) {
      const entries = Object.entries(summary).filter(([, v]) => v > 0);
      financeCharts.cat = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: entries.map(([k]) => k.replace(/_/g, ' ')),
          datasets: [{
            data: entries.map(([, v]) => v),
            backgroundColor: ['#ef4444', '#f59e0b', '#8b5cf6', '#60a5fa', '#10b981', '#f97316', '#ec4899'],
            borderWidth: 2, borderColor: '#1a2032',
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } }
          },
          cutout: '60%',
        }
      });
    }

    const dailyList = document.getElementById('daily-fin-list');
    if (dailyList) {
      if (!daily.length) {
        dailyList.innerHTML = '<div class="empty-state">Sin gastos registrados</div>';
      } else {
        const sorted = [...daily].sort((a, b) => new Date(b.date) - new Date(a.date));
        dailyList.innerHTML = sorted.map(d => {
          const amt = parseFloat(d.total_amount || 0);
          const cnt = parseInt(d.count || 0);
          return `
            <div class="fin-daily-row">
              <div>
                <div class="fin-daily-date">${d.date ? d.date.split('T')[0] : '—'}</div>
                <div class="fin-daily-count">${cnt} transacción${cnt !== 1 ? 'es' : ''}</div>
              </div>
              <span class="fin-amount-neg">${formatCurrency(amt)}</span>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err) {
    content.innerHTML = `<p style="color:var(--red);padding:1rem">${err.message}</p>`;
  }
}

/* ══════════════════════════════════════════════════════
   TAB: HISTORIAL DIARIO
══════════════════════════════════════════════════════ */
async function loadDailyExpenses() {
  const content = document.getElementById('finance-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const res = await FinanceService.getDaily();
    const data = res.data || [];
    const today = new Date().toISOString().split('T')[0];
    const todayData = data.find(d => d.date && d.date.startsWith(today));
    const total = todayData ? parseFloat(todayData.total_amount || 0) : 0;
    const count = todayData ? parseInt(todayData.count || 0) : 0;

    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    const maxAmt = sorted.reduce((m, d) => Math.max(m, parseFloat(d.total_amount || 0)), 0) || 1;

    content.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:1.25rem">
        <div class="kpi-card red">
          <span class="kpi-icon">📅</span>
          <div class="kpi-value">${formatCurrency(total)}</div>
          <div class="kpi-label">Gastos de Hoy</div>
        </div>
        <div class="kpi-card accent">
          <span class="kpi-icon">🔢</span>
          <div class="kpi-value">${count}</div>
          <div class="kpi-label">Transacciones Hoy</div>
        </div>
      </div>

      <div class="card" style="padding:0">
        <div class="card-header" style="padding:1rem 1.25rem">
          <span class="card-title">📅 Historial de Gastos Diarios</span>
          <span style="font-size:.75rem;color:var(--text-muted)">Últimos ${sorted.length} días con registros</span>
        </div>
        <div>
          ${sorted.length === 0
            ? '<div class="empty-state" style="padding:3rem">Sin datos disponibles</div>'
            : sorted.map(d => {
                const amt = parseFloat(d.total_amount || 0);
                const cnt = parseInt(d.count || 0);
                const barW = Math.round((amt / maxAmt) * 100);
                const isToday = d.date && d.date.startsWith(today);
                return `
                  <div class="fin-history-row ${isToday ? 'fin-history-today' : ''}">
                    <div class="fin-history-meta">
                      <span class="fin-history-date">${d.date ? d.date.split('T')[0] : '—'}</span>
                      ${isToday ? '<span class="fin-today-tag">hoy</span>' : ''}
                      <span class="fin-history-cnt">${cnt} registro${cnt !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="fin-history-bar-wrap">
                      <div class="fin-history-bar-bg">
                        <div class="fin-history-bar-fill" style="width:${barW}%"></div>
                      </div>
                    </div>
                    <span class="fin-amount-neg fin-history-amt">${formatCurrency(amt)}</span>
                  </div>
                `;
              }).join('')
          }
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      document.querySelectorAll('.fin-history-bar-fill').forEach(b => {
        const w = b.style.width;
        b.style.width = '0%';
        setTimeout(() => { b.style.width = w; }, 80);
      });
    });

  } catch (err) { showError(content, err.message); }
}

/* ══════════════════════════════════════════════════════
   MODAL: CREAR / EDITAR GASTO
══════════════════════════════════════════════════════ */
async function openFinanceForm(id) {
  let expense = null;
  let categories = [];
  let payMethods = [];

  try {
    const [catRes, pmRes, expRes] = await Promise.allSettled([
      FinanceService.getCategories(),
      FinanceService.getPaymentMethods(),
      id ? FinanceService.getById(id) : Promise.resolve(null),
    ]);
    categories = catRes.status === 'fulfilled' ? catRes.value.data || [] : [];
    payMethods = pmRes.status === 'fulfilled' ? pmRes.value.data || [] : [];
    expense = expRes.status === 'fulfilled' && expRes.value ? expRes.value.data : null;
  } catch {}

  const user = Store.get('user');
  const fields = [
    { name: 'description', label: 'Descripción', required: true, placeholder: 'Ej: Compra de flores...', span: 2 },
    { name: 'amount', label: 'Monto (S/)', type: 'number', required: true, step: '0.01', min: '0.01' },
    { name: 'date', label: 'Fecha', type: 'date', required: true },
    { name: 'category', label: 'Categoría', type: 'select', required: true,
      options: categories.map(c => ({ value: c, label: c.replace(/_/g, ' ') })) },
    { name: 'payment_method', label: 'Método de Pago', type: 'select',
      options: payMethods.map(m => ({ value: m, label: m })) },
    { name: 'notes', label: 'Notas', type: 'textarea', span: 2 },
  ];

  const today = new Date().toISOString().split('T')[0];
  const modal = showModal({
    title: id ? '✏️ Editar Gasto' : '+ Registrar Gasto',
    content: buildForm(fields, expense || { date: today }, { submitLabel: id ? 'Actualizar' : 'Registrar', onCancel: closeModal }),
    size: 'md',
  });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (data) => {
    data.created_by = user?.id;

    const cashboxSession = Store.get('cashbox');
    if (cashboxSession && cashboxSession.id) {
      data.cashbox_id = cashboxSession.id;
    }

    console.log('[DEBUG Finance create] Request data:', data);

    if (id) await FinanceService.update(id, data);
    else await FinanceService.create(data);
    Toast.success(id ? 'Gasto actualizado' : 'Gasto registrado');
    closeModal();
    loadExpensesData();
  });
}

async function deleteFinance(id) {
  if (!(await confirm('¿Eliminar este gasto?'))) return;
  try {
    await FinanceService.delete(id);
    Toast.success('Gasto eliminado');
    loadExpensesData();
  } catch (err) { Toast.error(err.message); }
}

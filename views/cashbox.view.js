/**
 * Vista Caja — Abrir, cerrar, transacciones, balance en tiempo real
 */
import { CashboxService } from '../services/api.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import { Toast, showModal, closeModal, confirm, buildTable, showLoading, showError } from '../components/ui.js';
import { buildForm, attachFormHandlers } from '../components/form.js';
import Store from '../utils/store.js';

export async function renderCashbox() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💰 Caja</h1>
        <p class="page-subtitle">Control de sesiones de caja y transacciones</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="window._cashboxLoad()">🔄 Actualizar</button>
    </div>
    <div id="cashbox-status-card" style="margin-bottom:1.5rem"></div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="current" onclick="window._cashboxTab('current')">📊 Sesión Actual</button>
      <button class="tab-btn" data-tab="history" onclick="window._cashboxTab('history')">📋 Historial</button>
      <button class="tab-btn" data-tab="summary" onclick="window._cashboxTab('summary')">📈 Resumen</button>
    </div>
    <div id="cashbox-tab-content"></div>
  `;

  window._cashboxLoad = () => loadCashboxStatus();
  window._cashboxTab = (tab) => switchCashboxTab(tab);
  window._openCashbox = () => openCashboxForm();
  window._closeCashbox = (id, expected) => closeCashboxForm(id, expected);
  window._addIncome = (id) => addTransactionForm(id, 'income');
  window._addExpense = (id) => addTransactionForm(id, 'expense');
  window._viewTransactions = (id) => loadTransactions(id);

  await loadCashboxStatus();
  switchCashboxTab('current');
}

async function loadCashboxStatus() {
  const card = document.getElementById('cashbox-status-card');
  if (!card) return;

  try {
    const res = await CashboxService.getStatus();
    const data = res.data;
    const session = data?.session;

    if (session && data.status === 'open') {
      Store.set('cashbox', session);
      updateTopbarCashbox(session, 'open');

      card.innerHTML = `
        <div class="card" style="border-color:var(--green)30;background:linear-gradient(135deg, var(--bg-card), var(--green)05)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
            <div style="display:flex;align-items:center;gap:1rem">
              <div style="width:48px;height:48px;background:var(--green)20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem">💰</div>
              <div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">Caja #${session.id} — ABIERTA</div>
                <div style="font-size:.8125rem;color:var(--text-secondary)">
                  Apertura: ${formatDate(session.opened_at)} · ${session.user_first_name || ''} ${session.user_last_name || ''}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:3rem;flex-wrap:wrap">
              <div style="text-align:center">
                <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Monto Apertura</div>
                <div style="font-size:1.25rem;font-weight:800;font-family:var(--font-mono)">${formatCurrency(session.opening_amount)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Ingresos</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--green);font-family:var(--font-mono)">+${formatCurrency(data.total_income)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Gastos</div>
                <div style="font-size:1.25rem;font-weight:800;color:var(--red);font-family:var(--font-mono)">-${formatCurrency(data.total_expenses)}</div>
              </div>
              <div style="text-align:center">
                <div style="font-size:.75rem;color:var(--text-muted);text-transform:uppercase">Balance</div>
                <div style="font-size:1.5rem;font-weight:800;color:var(--accent);font-family:var(--font-mono)">${formatCurrency(data.current_balance)}</div>
              </div>
            </div>
            <div style="display:flex;gap:.75rem;flex-wrap:wrap">
              <button class="btn btn-success btn-sm" onclick="window._addIncome(${session.id})">+ Ingreso</button>
              <button class="btn btn-danger btn-sm" onclick="window._addExpense(${session.id})">+ Egreso</button>
              <button class="btn btn-warning btn-sm" onclick="window._viewTransactions(${session.id})">📋 Transacciones</button>
              <button class="btn btn-secondary btn-sm" onclick="window._closeCashbox(${session.id}, ${data.current_balance})">🔒 Cerrar Caja</button>
            </div>
          </div>
        </div>
      `;
    } else {
      Store.set('cashbox', null);
      updateTopbarCashbox(null, 'closed');
      card.innerHTML = `
        <div class="card" style="border-color:var(--red)30;background:linear-gradient(135deg, var(--bg-card), var(--red)05)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
            <div style="display:flex;align-items:center;gap:1rem">
              <div style="width:48px;height:48px;background:var(--red)20;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem">🔒</div>
              <div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary)">Sin sesión de caja activa</div>
                <div style="font-size:.8125rem;color:var(--text-secondary)">Abre una sesión de caja para procesar ventas</div>
              </div>
            </div>
            <button class="btn btn-primary" onclick="window._openCashbox()">🔓 Abrir Caja</button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    card.innerHTML = `<div class="card"><p style="color:var(--red)">Error: ${err.message}</p></div>`;
  }
}

function switchCashboxTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  switch (tab) {
    case 'current': loadCurrentSessionDetails(); break;
    case 'history': loadCashboxHistory(); break;
    case 'summary': loadCashboxSummary(); break;
  }
}

async function loadCurrentSessionDetails() {
  const content = document.getElementById('cashbox-tab-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  try {
    const session = Store.get('cashbox');
    if (!session) {
      content.innerHTML = `<div class="empty-state" style="padding:3rem">
        <div style="font-size:3rem">🔒</div>
        <p>No hay sesión de caja activa. Abre una para ver los detalles.</p>
      </div>`;
      return;
    }

    const [expectedRes] = await Promise.allSettled([CashboxService.getExpected(session.id)]);
    const expected = expectedRes.status === 'fulfilled' ? expectedRes.value.data : {};

    content.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:1.5rem">
        <div class="kpi-card green">
          <span class="kpi-icon">💵</span>
          <div class="kpi-value">${formatCurrency(session.opening_amount)}</div>
          <div class="kpi-label">Fondo de Apertura</div>
        </div>
        <div class="kpi-card accent">
          <span class="kpi-icon">📥</span>
          <div class="kpi-value">${formatCurrency(expected.total_income)}</div>
          <div class="kpi-label">Total Ingresos</div>
        </div>
        <div class="kpi-card red">
          <span class="kpi-icon">📤</span>
          <div class="kpi-value">${formatCurrency(expected.total_expenses)}</div>
          <div class="kpi-label">Total Egresos</div>
        </div>
        <div class="kpi-card blue">
          <span class="kpi-icon">💰</span>
          <div class="kpi-value">${formatCurrency(expected.expected_amount)}</div>
          <div class="kpi-label">Efectivo Esperado</div>
        </div>
      </div>
      <div id="session-transactions" class="card" style="padding:0">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border-light)">
          <span class="card-title">Transacciones de la sesión</span>
        </div>
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    `;

    await loadTransactionsInline(session.id);
  } catch (err) {
    content.innerHTML = `<p style="color:var(--red);padding:1rem">${err.message}</p>`;
  }
}

async function loadTransactionsInline(cashboxId) {
  const container = document.querySelector('#session-transactions');
  if (!container) return;
  try {
    const res = await CashboxService.getTransactions(cashboxId);
    const data = res.data || [];
    const columns = [
      { key: 'created_at', label: 'Hora', render: (v) => `<span style="font-size:.8125rem;color:var(--text-muted)">${new Date(v).toLocaleTimeString('es-PE')}</span>` },
      {
        key: 'flow_type_code', label: 'Tipo',
        render: (v) => v?.includes('income')
          ? `<span class="status-badge status-active">↑ Ingreso</span>`
          : `<span class="status-badge status-cancelled">↓ Egreso</span>`
      },
      { key: 'payment_method_name', label: 'Método' },
      { key: 'amount', label: 'Monto', render: (v, row) => `<span style="font-family:var(--font-mono);font-weight:700;color:${row.flow_type_code?.includes('income') ? 'var(--green)' : 'var(--red)'}">${row.flow_type_code?.includes('income') ? '+' : '-'}${formatCurrency(parseFloat(v) || 0)}</span>` },
    ];
    const div = container.querySelector('.page-loading') || container;
    div.outerHTML = buildTable(columns, data, { emptyMsg: 'Sin transacciones aún' });
  } catch (err) {
    console.error('Error loading inline transactions:', err);
  }
}

async function loadTransactions(cashboxId) {
  showModal({ title: `📋 Transacciones Caja #${cashboxId}`, size: 'lg', content: `<div class="page-loading"><div class="spinner"></div></div>` });
  try {
    const res = await CashboxService.getTransactions(cashboxId);
    const data = res.data || [];
    const columns = [
      { key: 'created_at', label: 'Hora', render: (v) => new Date(v).toLocaleTimeString('es-PE') },
      { key: 'flow_type_code', label: 'Tipo', render: (v) => v?.includes('income') ? `<span class="status-badge status-active">↑ Ingreso</span>` : `<span class="status-badge status-cancelled">↓ Egreso</span>` },
      { key: 'payment_method_name', label: 'Método' },
      { key: 'amount', label: 'Monto', render: (v, row) => `<span style="font-family:var(--font-mono);font-weight:700;color:${row.flow_type_code?.includes('income') ? 'var(--green)' : 'var(--red)'}">${formatCurrency(parseFloat(v) || 0)}</span>` },
    ];
    document.querySelector('#modal-overlay .modal-body').innerHTML = buildTable(columns, data, { emptyMsg: 'Sin transacciones' });
  } catch (err) {
    console.error('Error loading transactions:', err);
    document.querySelector('#modal-overlay .modal-body').innerHTML = `<div class="empty-state">Error al cargar transacciones: ${err.message}</div>`;
  }
}

async function loadCashboxHistory() {
  const content = document.getElementById('cashbox-tab-content');
  content.innerHTML = `
    <div class="filter-bar">
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-input" id="cbx-status-filter" onchange="window._cbxLoadHistory()">
          <option value="">Todos</option><option value="open">Abierta</option><option value="closed">Cerrada</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Desde</label>
        <input type="date" class="form-input" id="cbx-date-from" onchange="window._cbxLoadHistory()">
      </div>
      <div class="form-group">
        <label class="form-label">Hasta</label>
        <input type="date" class="form-input" id="cbx-date-to" onchange="window._cbxLoadHistory()">
      </div>
    </div>
    <div class="card" style="padding:0">
      <div id="cbx-history-table"><div class="page-loading"><div class="spinner"></div></div></div>
    </div>
  `;
  window._cbxLoadHistory = loadHistoryData;
  await loadHistoryData();
}

async function loadHistoryData() {
  const container = document.getElementById('cbx-history-table');
  if (!container) return;
  showLoading(container);
  try {
    const params = {};
    const s = document.getElementById('cbx-status-filter')?.value;
    const f = document.getElementById('cbx-date-from')?.value;
    const t = document.getElementById('cbx-date-to')?.value;
    if (s) params.status = s;
    if (f) params.start_date = f;
    if (t) params.end_date = t;

    const res = await CashboxService.getAll({ ...params, limit: 50 });
    const columns = [
      { key: 'id', label: '#', render: (v) => `<span style="font-family:var(--font-mono)">#${v}</span>` },
      { key: 'user_first_name', label: 'Empleado', render: (v, row) => `${v || ''} ${row.user_last_name || ''}`.trim() },
      { key: 'opening_amount', label: 'Apertura', render: (v) => formatCurrency(v) },
      { key: 'closing_amount', label: 'Cierre', render: (v) => v ? formatCurrency(v) : '—' },
      { key: 'difference', label: 'Diferencia', render: (v) => v != null ? `<span style="color:${v >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${v >= 0 ? '+' : ''}${formatCurrency(v)}</span>` : '—' },
      { key: 'status', label: 'Estado', render: (v) => `<span class="status-badge status-${v}">${v === 'open' ? '● Abierta' : '● Cerrada'}</span>` },
      { key: 'opened_at', label: 'Apertura', render: (v) => formatDate(v, true) },
    ];
    container.innerHTML = buildTable(columns, res.data || [], { emptyMsg: 'Sin sesiones de caja' });
  } catch (err) {
    showError(container, err.message);
  }
}

async function loadCashboxSummary() {
  const content = document.getElementById('cashbox-tab-content');
  content.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
  
  try {
    const res = await CashboxService.getSummary();
    const resData = res.data || {};
    
    // Backend devuelve: { summary: {...}, period: {} }
    const data = resData.summary || {};
    
    // Mapear campos: el backend usa nombres diferentes
    const sessionsCount = parseInt(data.closed_sessions) || 0;
    const totalOpening = parseFloat(data.total_opening) || 0;
    const totalClosing = parseFloat(data.total_closing) || 0;
    const totalDifference = parseFloat(data.total_difference) || 0;
    
    // Calcular ingresos y egresos basados en el flujo de caja
    // Con los datos del backend:
    // - total_opening: suma de todos los montos de apertura (2470)
    // - total_closing: suma de todos los montos de cierre (5747.04)
    // - total_difference: suma de diferencias (1259.99)
    const netMovement = totalClosing - totalOpening;
    
    const totalIncome = netMovement + Math.max(0, totalDifference);
    const totalExpenses = Math.max(0, -totalDifference);
    
    content.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card green"><span class="kpi-icon">📂</span><div class="kpi-value">${sessionsCount}</div><div class="kpi-label">Total Sesiones</div></div>
        <div class="kpi-card accent"><span class="kpi-icon">💰</span><div class="kpi-value">${formatCurrency(totalIncome)}</div><div class="kpi-label">Total Ingresos</div></div>
        <div class="kpi-card red"><span class="kpi-icon">📤</span><div class="kpi-value">${formatCurrency(totalExpenses)}</div><div class="kpi-label">Total Egresos</div></div>
        <div class="kpi-card blue"><span class="kpi-icon">🏦</span><div class="kpi-value">${formatCurrency(totalClosing)}</div><div class="kpi-label">Total Cierre</div></div>
      </div>
    `;
  } catch (err) {
    showError(content, err.message);
  }
}

function openCashboxForm() {
  const user = Store.get('user');
  const fields = [
    { name: 'opening_amount', label: 'Monto de Apertura (S/)', type: 'number', required: true, step: '0.01', min: '0', span: 2, hint: 'Efectivo físico con el que inicia la caja' },
  ];
  const modal = showModal({
    title: '🔓 Abrir Sesión de Caja',
    content: buildForm(fields, {}, { submitLabel: 'Abrir Caja', onCancel: closeModal }),
    size: 'sm',
  });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (data) => {
    data.user_id = user.id;
    const res = await CashboxService.open(data);
    Store.set('cashbox', res.data);
    Toast.success('✅ Caja abierta exitosamente');
    closeModal();
    loadCashboxStatus();
    switchCashboxTab('current');
  });
}

function closeCashboxForm(cashboxId, expectedAmount) {
  const fields = [
    { name: 'closing_amount', label: 'Efectivo Contado (S/)', type: 'number', required: true, step: '0.01', min: '0', span: 2,
      hint: `Efectivo esperado: ${formatCurrency(expectedAmount)}` },
    { name: 'notes', label: 'Observaciones', type: 'textarea', span: 2 },
  ];
  const modal = showModal({
    title: '🔒 Cerrar Sesión de Caja',
    content: buildForm(fields, { closing_amount: expectedAmount }, { submitLabel: 'Cerrar Caja', onCancel: closeModal }),
    size: 'sm',
  });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (data) => {
    const res = await CashboxService.close(cashboxId, { closing_amount: data.closing_amount, expected_amount: expectedAmount });
    const diff = res.data?.difference || 0;
    Toast.success(`Caja cerrada. Diferencia: ${formatCurrency(diff)}`);
    Store.set('cashbox', null);
    closeModal();
    loadCashboxStatus();
    updateTopbarCashbox(null, 'closed');
  });
}

function addTransactionForm(cashboxId, type) {
  const isIncome = type === 'income';
  const fields = [
    { name: 'amount', label: `Monto (S/)`, type: 'number', required: true, step: '0.01', min: '0.01' },
    { name: 'description', label: 'Descripción', required: true, placeholder: isIncome ? 'Venta adicional...' : 'Compra de insumos...' },
    ...(isIncome ? [{ name: 'payment_method', label: 'Método de Pago', type: 'select',
      options: ['cash','card','yape','plin','transfer'].map(v => ({ value: v, label: v })) }] : [
      { name: 'reason', label: 'Motivo', placeholder: 'mantenimiento, servicios...' }
    ]),
  ];
  const modal = showModal({
    title: isIncome ? '+ Registrar Ingreso' : '+ Registrar Egreso',
    content: buildForm(fields, {}, { submitLabel: isIncome ? 'Registrar Ingreso' : 'Registrar Egreso', onCancel: closeModal }),
    size: 'sm',
  });
  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);
  
  // Agregar debug para ver qué datos se envían
  console.log('[DEBUG addTransactionForm] cashboxId:', cashboxId, 'type:', type);
  
  attachFormHandlers(modal.querySelector('#dynamic-form'), async (formData) => {
    // El backend requiere cashbox_id en el cuerpo del request
    const requestData = {
      ...formData,
      cashbox_id: cashboxId
    };
    
    console.log('[DEBUG addTransactionForm] Request data:', requestData);
    
    if (isIncome) {
      await CashboxService.addIncome(cashboxId, requestData);
    } else {
      await CashboxService.addExpense(cashboxId, requestData);
    }
    Toast.success(`${isIncome ? 'Ingreso' : 'Egreso'} registrado`);
    closeModal();
    loadCashboxStatus();
    switchCashboxTab('current');
  });
}

function updateTopbarCashbox(session, status) {
  const dot = document.getElementById('cashbox-dot');
  const text = document.getElementById('cashbox-status-text');
  if (!dot || !text) return;
  if (status === 'open' && session) {
    dot.className = 'cashbox-dot open';
    text.textContent = `Caja #${session.id} abierta`;
  } else {
    dot.className = 'cashbox-dot closed';
    text.textContent = 'Sin caja abierta';
  }
}

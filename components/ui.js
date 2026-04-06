/**
 * Componentes UI reutilizables
 */
import { escapeHtml } from '../utils/helpers.js';

// ─── TOAST ──────────────────────────────────────────────────────────────────
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position:fixed;top:1.25rem;right:1.25rem;z-index:9999;
      display:flex;flex-direction:column;gap:.5rem;pointer-events:none;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

  const el = document.createElement('div');
  el.style.cssText = `
    background:#1e2130;border:1px solid ${colors[type]}40;
    color:#f1f5f9;padding:.75rem 1rem;border-radius:.5rem;
    display:flex;align-items:center;gap:.625rem;max-width:22rem;
    box-shadow:0 4px 20px rgba(0,0,0,.4);pointer-events:all;
    transform:translateX(120%);transition:transform .3s cubic-bezier(.34,1.56,.64,1);
    border-left:3px solid ${colors[type]};font-size:.875rem;
  `;
  el.innerHTML = `
    <span style="color:${colors[type]};font-weight:700;font-size:1rem">${icons[type]}</span>
    <span style="flex:1">${escapeHtml(message)}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1rem;padding:0;line-height:1">×</button>
  `;
  container.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    el.addEventListener('transitionend', () => el.remove());
  }, duration);
}

export const Toast = {
  success: (msg) => toast(msg, 'success'),
  error: (msg) => toast(msg, 'error'),
  warning: (msg) => toast(msg, 'warning'),
  info: (msg) => toast(msg, 'info'),
};

// ─── MODAL ──────────────────────────────────────────────────────────────────
let activeModal = null;

export function showModal({ title, content, size = 'md', onClose }) {
  closeModal();
  const sizes = { sm: '28rem', md: '40rem', lg: '56rem', xl: '70rem' };
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:8000;
    display:flex;align-items:center;justify-content:center;padding:1rem;
    backdrop-filter:blur(4px);opacity:0;transition:opacity .2s;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:#1e2130;border:1px solid #2d3454;border-radius:.75rem;
    max-width:${sizes[size]};width:100%;max-height:90vh;display:flex;
    flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,.6);
    transform:scale(.95);transition:transform .2s cubic-bezier(.34,1.56,.64,1);
  `;
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid #2d3454">
      <h3 style="margin:0;color:#f1f5f9;font-size:1.1rem;font-weight:600">${escapeHtml(title)}</h3>
      <button id="modal-close-btn" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.25rem;padding:.25rem;border-radius:.375rem;transition:all .2s">×</button>
    </div>
    <div class="modal-body" style="padding:1.5rem;overflow-y:auto;flex:1">${typeof content === 'string' ? content : ''}</div>
  `;

  if (typeof content !== 'string') {
    modal.querySelector('.modal-body').appendChild(content);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  activeModal = { overlay, onClose };

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.transform = 'scale(1)';
  });

  modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', handleEscapeKey);

  return modal;
}

function handleEscapeKey(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (!activeModal) return;
  const { overlay, onClose } = activeModal;
  overlay.style.opacity = '0';
  overlay.querySelector('div').style.transform = 'scale(.95)';
  setTimeout(() => {
    overlay.remove();
    if (onClose) onClose();
  }, 200);
  document.removeEventListener('keydown', handleEscapeKey);
  activeModal = null;
}

// ─── CONFIRM DIALOG ─────────────────────────────────────────────────────────
export function confirm(message, title = '¿Confirmar acción?') {
  return new Promise((resolve) => {
    const content = `
      <p style="color:#cbd5e1;margin:0 0 1.5rem">${escapeHtml(message)}</p>
      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button id="confirm-cancel" class="btn btn-ghost">Cancelar</button>
        <button id="confirm-ok" class="btn btn-danger">Confirmar</button>
      </div>
    `;
    const modal = showModal({ title, content, size: 'sm' });
    modal.querySelector('#confirm-cancel').addEventListener('click', () => { closeModal(); resolve(false); });
    modal.querySelector('#confirm-ok').addEventListener('click', () => { closeModal(); resolve(true); });
  });
}

// ─── LOADING OVERLAY ────────────────────────────────────────────────────────
export function showLoading(container, msg = 'Cargando...') {
  const el = document.createElement('div');
  el.className = 'loading-overlay';
  el.style.cssText = `
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:1rem;padding:3rem;color:#94a3b8;
  `;
  el.innerHTML = `
    <div class="spinner"></div>
    <span style="font-size:.875rem">${escapeHtml(msg)}</span>
  `;
  if (container) {
    container.innerHTML = '';
    container.appendChild(el);
  }
  
  // Auto-remove loading after 10 seconds to avoid stuck UI
  const timeoutId = setTimeout(() => {
    if (el.parentElement === container) {
      el.innerHTML = `
        <div style="font-size:2rem">⏱️</div>
        <span style="font-size:.875rem">Tiempo de espera excesivo</span>
        <button class="btn btn-ghost btn-sm" onclick="location.reload()">Reintentar</button>
      `;
    }
  }, 10000);
  
  // Attach timeout ID to element so it can be cleared
  el._timeoutId = timeoutId;
  return el;
}

export function showError(container, message) {
  if (!container) return;
  
  // Clear any pending loading timeout
  const existingEl = container.querySelector('.loading-overlay');
  if (existingEl && existingEl._timeoutId) {
    clearTimeout(existingEl._timeoutId);
  }
  
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:3rem;color:#94a3b8">
      <div style="font-size:2.5rem">⚠️</div>
      <p style="margin:0;color:#ef4444;text-align:center">${escapeHtml(message)}</p>
      <button class="btn btn-ghost" onclick="window.location.reload()">Reintentar</button>
    </div>
  `;
}

// ─── TABLE BUILDER ──────────────────────────────────────────────────────────
/**
 * Genera una tabla HTML a partir de columnas y datos
 * @param {Array} columns - [{key, label, render?}]
 * @param {Array} data
 * @param {Object} options - {actions?, emptyMsg?}
 */
export function buildTable(columns, data, options = {}) {
  if (!data || data.length === 0) {
    return `<div class="empty-state">
      <div style="font-size:2rem;margin-bottom:.5rem">📋</div>
      <p>${options.emptyMsg || 'No hay datos disponibles'}</p>
    </div>`;
  }

  const thead = `<thead><tr>${columns.map(col =>
    `<th>${escapeHtml(col.label)}</th>`
  ).join('')}${options.actions ? '<th>Acciones</th>' : ''}</tr></thead>`;

  const tbody = `<tbody>${data.map((row, i) =>
    `<tr data-id="${row.id || i}">${columns.map(col => {
      const val = col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—');
      return `<td>${val}</td>`;
    }).join('')}${options.actions ? `<td>${options.actions(row)}</td>` : ''}</tr>`
  ).join('')}</tbody>`;

  return `<div class="table-wrapper"><table class="data-table">${thead}${tbody}</table></div>`;
}

// ─── BADGE ──────────────────────────────────────────────────────────────────
export function badge(text, type = 'info') {
  const colors = {
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
    info: '#3b82f6', purple: '#8b5cf6', gray: '#64748b'
  };
  const bg = colors[type] || colors.info;
  return `<span style="background:${bg}20;color:${bg};padding:.125rem .5rem;border-radius:9999px;font-size:.75rem;font-weight:600;border:1px solid ${bg}40">${escapeHtml(String(text))}</span>`;
}

// ─── PAGINATION ─────────────────────────────────────────────────────────────
export function renderPagination(container, total, page, limit, onPageChange) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  container.innerHTML = `
    <div class="pagination">
      <button class="page-btn" ${page === 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>
      ${pages.map(p => p === '...'
        ? `<span class="page-ellipsis">…</span>`
        : `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
      ).join('')}
      <button class="page-btn" ${page === totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>
    </div>
  `;

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
  });
}

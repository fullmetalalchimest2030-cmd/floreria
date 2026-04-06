/**
 * Utilidades y helpers generales
 */

// ─── FORMATO ────────────────────────────────────────────────────────────────
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return 'S/ 0.00';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatDate(dateStr, short = false) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-PE', short
    ? { day: '2-digit', month: '2-digit', year: 'numeric' }
    : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  );
}

export function formatDateInput(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function formatNumber(n) {
  return new Intl.NumberFormat('es-PE').format(n || 0);
}

export function formatPercent(n) {
  return `${(Number(n) || 0).toFixed(1)}%`;
}

// ─── ROLES ──────────────────────────────────────────────────────────────────
export const ROLES = {
  admin: { label: 'Administrador', color: '#e74c3c' },
  manager: { label: 'Gerente', color: '#e67e22' },
  employee: { label: 'Empleado', color: '#27ae60' },
  cashier: { label: 'Cajero', color: '#2980b9' },
  warehouse: { label: 'Almacenero', color: '#8e44ad' },
};

export function getRoleLabel(role) {
  return ROLES[role]?.label || role;
}

export function hasRole(user, ...roles) {
  if (!user) return false;
  return roles.includes(user.role);
}

// ─── VALIDACIONES ───────────────────────────────────────────────────────────
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateRequired(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function validatePositive(value) {
  return Number(value) > 0;
}

// ─── MISC ───────────────────────────────────────────────────────────────────
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function buildQueryString(params) {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  ).toString();
}

export function getInitials(firstName, lastName) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
}

export function severityClass(severity) {
  const map = { critical: 'danger', warning: 'warning', info: 'info', success: 'success' };
  return map[severity] || 'info';
}

export function paymentLabel(method) {
  const labels = { cash: 'Efectivo', card: 'Tarjeta', yape: 'Yape', plin: 'Plin', transfer: 'Transferencia' };
  return labels[method] || method;
}

export function movementTypeLabel(type) {
  const map = { IN: 'Entrada', OUT: 'Salida', ADJUSTMENT: 'Ajuste', WASTE: 'Merma' };
  return map[type] || type;
}

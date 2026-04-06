/**
 * Servicios API - Capa de acceso a datos
 * Cada función corresponde a un endpoint de la API
 */
import http from './http.js';

// ─── AUTH ───────────────────────────────────────────────────────────────────
export const AuthService = {
  login: (email, password) => http.post('/auth/login', { email, password }),
  logout: () => http.post('/auth/logout'),
  verify: () => http.get('/auth/verify'),
  refresh: (refreshToken) => http.post('/auth/refresh', { refreshToken }),
};

// ─── EMPLEADOS ───────────────────────────────────────────────────────────────
export const EmployeeService = {
  getAll: (params = {}) => http.get('/employees', params),
  getById: (id) => http.get(`/employees/${id}`),
  create: (data) => http.post('/employees', data),
  update: (id, data) => http.put(`/employees/${id}`, data),
  delete: (id) => http.delete(`/employees/${id}`),
  restore: (id) => http.post(`/employees/${id}/restore`),
  getPerformance: (id, params = {}) => http.get(`/employees/${id}/performance`, params),
  changePassword: (id, data) => http.put(`/employees/${id}/password`, data),
};

// ─── CATEGORÍAS ─────────────────────────────────────────────────────────────
export const CategoryService = {
  getAll: () => http.get('/categories'),
  getById: (id) => http.get(`/categories/${id}`),
  create: (data) => http.post('/categories', data),
  update: (id, data) => http.put(`/categories/${id}`, data),
  delete: (id) => http.delete(`/categories/${id}`),
};

// ─── PRODUCTOS ──────────────────────────────────────────────────────────────
export const ProductService = {
  getAll: (params = {}) => http.get('/products', params),
  getById: (id) => http.get(`/products/${id}`),
  create: (data) => http.post('/products', data),
  update: (id, data) => http.put(`/products/${id}`, data),
  delete: (id) => http.delete(`/products/${id}`),
  restore: (id) => http.put(`/products/${id}/restore`),
  getByCategory: (categoryId) => http.get(`/products/category/${categoryId}`),
  getLowStock: () => http.get('/products/low-stock'),
  updateStock: (id, data) => http.put(`/products/${id}/stock`, data),
  search: (q) => http.get('/products/search', { q }),
};

// ─── INVENTARIO ─────────────────────────────────────────────────────────────
export const InventoryService = {
  getAll: (params = {}) => http.get('/inventory', params),
  getById: (id) => http.get(`/inventory/${id}`),
  create: (data) => http.post('/inventory', data),
  getKardex: (productId, params = {}) => http.get(`/inventory/kardex/${productId}`, params),
  getLowStock: () => http.get('/inventory/low-stock'),
  getSummary: () => http.get('/inventory/summary'),
  getStats: (params = {}) => http.get('/inventory/stats', params),
  getStock: (productId) => http.get(`/inventory/stock/${productId}`),
  bulk: (movements) => http.post('/inventory/bulk', { movements }),
  validateStock: (items) => http.post('/inventory/validate-stock', { items }),
};

// ─── RECETAS ────────────────────────────────────────────────────────────────
export const RecipeService = {
  getAll: () => http.get('/recipes'),
  getById: (id) => http.get(`/recipes/${id}`),
  create: (data) => http.post('/recipes', data),
  update: (id, data) => http.put(`/recipes/${id}`, data),
  delete: (id) => http.delete(`/recipes/${id}`),
  getAvailable: () => http.get('/recipes/available'),
  getPopular: (params = {}) => http.get('/recipes/popular', params),
  getByCategory: (categoryId) => http.get(`/recipes/category/${categoryId}`),
  validate: (recipeId, quantity) => http.post(`/recipes/${recipeId}/validate`, { quantity }),
  produce: (recipeId, data) => http.post(`/recipes/${recipeId}/produce`, data),
  calculateCost: (ingredients) => http.post('/recipes/calculate-cost', { ingredients }),
  toggleCatalog: (id, show) => http.put(`/recipes/${id}/catalog`, { show_in_catalog: show }),
};

// ─── VENTAS ─────────────────────────────────────────────────────────────────
export const SaleService = {
  getAll: (params = {}) => http.get('/sales', params),
  getById: (id) => http.get(`/sales/${id}`),
  getDetailed: (id) => http.get(`/sales/${id}/detailed`),
  create: (data) => http.post('/sales', data),
  update: (id, data) => http.put(`/sales/${id}`, data),
  cancel: (id) => http.delete(`/sales/${id}`),
  complete: (id) => http.post(`/sales/${id}/complete`),
  getToday: () => http.get('/sales/today'),
  getStats: (params = {}) => http.get('/sales/stats', params),
  getByEmployee: (employeeId, params = {}) => http.get(`/sales/employee/${employeeId}`, params),
  quickSale: (data) => http.post('/sales/quick-sale', data),
  calculateTotal: (items) => http.post('/sales/calculate-total', { items }),
};

// ─── CAJA ───────────────────────────────────────────────────────────────────
export const CashboxService = {
  getAll: (params = {}) => http.get('/cashbox', params),
  getById: (id) => http.get(`/cashbox/${id}`),
  getCurrent: () => http.get('/cashbox/current'),
  open: (data) => http.post('/cashbox/open', data),
  close: (id, data) => http.post(`/cashbox/${id}/close`, data),
  addIncome: (cashboxId, data) => http.post(`/cashbox/${cashboxId}/income`, data),
  addExpense: (cashboxId, data) => http.post(`/cashbox/${cashboxId}/expense`, data),
  getTransactions: (cashboxId) => http.get(`/cashbox/${cashboxId}/transactions`),
  getSummary: (params = {}) => http.get('/cashbox/summary', params),
  getToday: () => http.get('/cashbox/today'),
  getStatus: (params = {}) => http.get('/cashbox/status', params),
  getExpected: (cashboxId) => http.get(`/cashbox/${cashboxId}/expected`),
};

// ─── FINANZAS ───────────────────────────────────────────────────────────────
export const FinanceService = {
  getAll: (params = {}) => http.get('/finances', params),
  getById: (id) => http.get(`/finances/${id}`),
  create: (data) => http.post('/finances', data),
  update: (id, data) => http.put(`/finances/${id}`, data),
  delete: (id) => http.delete(`/finances/${id}`),
  getSummaryByCategory: (params = {}) => http.get('/finances/summary/category', params),
  getDaily: (params = {}) => http.get('/finances/daily', params),
  getCategories: () => http.get('/finances/categories'),
  getPaymentMethods: () => http.get('/finances/payment-methods'),
  // Capital de Trabajo
  getWorkingCapital: (params = {}) => http.get('/finances/working-capital', params),
  getInventoryValue: () => http.get('/finances/inventory-value'),
  getWasteValue: (params = {}) => http.get('/finances/waste-value', params),
  getCashInBoxes: (params = {}) => http.get('/finances/cash-in-boxes', params),
  getCapitalConfig: () => http.get('/finances/capital-config'),
  updateCapitalConfig: (data) => http.put('/finances/capital-config', data),
};

// ─── REPORTES ───────────────────────────────────────────────────────────────
export const ReportService = {
  getProfitability: (params = {}) => http.get('/reports/profitability', params),
  getPaymentMethod: (params = {}) => http.get('/reports/payment-method', params),
  getEmployee: (params = {}) => http.get('/reports/employee', params),
  getWaste: (params = {}) => http.get('/reports/waste', params),
  getInventoryTurnover: () => http.get('/reports/inventory-turnover'),
  getProductPerformance: (params = {}) => http.get('/reports/product-performance', params),
  getForecast: (params = {}) => http.get('/reports/forecast', params),
  getComprehensive: (params = {}) => http.get('/reports/comprehensive', params),
};

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
export const DashboardService = {
  getAll: () => http.get('/dashboard'),
  getDailySales: () => http.get('/dashboard/daily-sales'),
  getMonthlySales: (params = {}) => http.get('/dashboard/monthly-sales', params),
  getMonthlyProfit: () => http.get('/dashboard/monthly-profit'),
  getLowStock: () => http.get('/dashboard/low-stock'),
  getTopSellers: (params = {}) => http.get('/dashboard/top-sellers', params),
  getBottomSellers: (params = {}) => http.get('/dashboard/bottom-sellers', params),
  getQuickStats: () => http.get('/dashboard/quick-stats'),
};

// ─── ALERTAS ────────────────────────────────────────────────────────────────
export const AlertService = {
  getAll: () => http.get('/alerts'),
  getById: (id) => http.get(`/alerts/${id}`),
  create: (data) => http.post('/alerts', data),
  markRead: (id) => http.put(`/alerts/${id}/read`),
  resolve: (id) => http.put(`/alerts/${id}/resolve`),
  delete: (id) => http.delete(`/alerts/${id}`),
  getUnreadCount: () => http.get('/alerts/unread/count'),
  markAllRead: () => http.put('/alerts/read-all'),
  getCritical: (params = {}) => http.get('/alerts/critical', params),
  checkLowStock: () => http.post('/alerts/check/low-stock'),
};

// ─── AUDITORÍA ──────────────────────────────────────────────────────────────
export const AuditService = {
  getAll: (params = {}) => http.get('/audit', params),
  getById: (id) => http.get(`/audit/${id}`),
  getByUser: (userId) => http.get(`/audit/user/${userId}`),
  getByRecord: (tableName, recordId) => http.get(`/audit/record/${tableName}/${recordId}`),
  getStatistics: (params = {}) => http.get('/audit/statistics', params),
  create: (data) => http.post('/audit', data),
};

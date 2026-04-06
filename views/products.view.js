/**
 * Vista Productos — CRUD completo
 */
import { ProductService, CategoryService } from '../services/api.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import { badge, Toast, showModal, closeModal, confirm, buildTable, showLoading, showError, renderPagination } from '../components/ui.js';
import { buildForm, attachFormHandlers } from '../components/form.js';

let currentPage = 1;
const PAGE_SIZE = 20;

export async function renderProducts() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🌺 Productos</h1>
        <p class="page-subtitle">Gestión del catálogo de productos</p>
      </div>
      <div style="display:flex;gap:.75rem">
        <button class="btn btn-secondary btn-sm" onclick="window._productsLoad()">🔄</button>
        <button class="btn btn-primary" onclick="window._productCreate()">+ Nuevo Producto</button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input type="text" class="form-input" id="prod-search" placeholder="Buscar por nombre o SKU...">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-input" id="prod-cat-filter" style="min-width:150px">
          <option value="">Todas</option>
        </select>
      </div>
      <button class="btn btn-ghost btn-sm" id="prod-low-stock-btn" onclick="window._productsFilterLowStock()">
        ⚠️ Bajo stock
      </button>
    </div>

    <div class="card" style="padding:0">
      <div id="products-table-container">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
      <div id="products-pagination" style="padding:.75rem 1rem"></div>
    </div>
  `;

  window._productsLoad = () => loadProducts();
  window._productCreate = () => openProductForm(null);
  window._productEdit = (id) => openProductForm(id);
  window._productDelete = (id) => deleteProduct(id);
  window._productRestore = (id) => restoreProduct(id);
  window._productsFilterLowStock = () => loadLowStock();
  window._productToggleCatalog = (id, show) => toggleProductCatalog(id, show);

  // Búsqueda con debounce
  let searchTimer;
  document.getElementById('prod-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchProducts(e.target.value), 350);
  });

  await Promise.all([loadCategories(), loadProducts()]);
}

async function loadCategories() {
  try {
    const res = await CategoryService.getAll();
    const select = document.getElementById('prod-cat-filter');
    if (!select) return;
    (res.data || []).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => loadProducts());
  } catch {}
}

async function loadProducts() {
  const container = document.getElementById('products-table-container');
  if (!container) return;
  showLoading(container);

  try {
    const catFilter = document.getElementById('prod-cat-filter')?.value;
    const params = { limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE };
    if (catFilter) params.category_id = catFilter;

    let res;
    if (catFilter) {
      res = await ProductService.getByCategory(catFilter);
    } else {
      res = await ProductService.getAll(params);
    }

    const data = res.data || [];
    renderProductsTable(container, data);
  } catch (err) {
    showError(container, err.message);
  }
}

async function searchProducts(q) {
  const container = document.getElementById('products-table-container');
  if (!q.trim()) { loadProducts(); return; }
  showLoading(container, 'Buscando...');
  try {
    const res = await ProductService.search(q);
    renderProductsTable(container, res.data || []);
  } catch (err) {
    showError(container, err.message);
  }
}

async function loadLowStock() {
  const container = document.getElementById('products-table-container');
  showLoading(container, 'Cargando productos con bajo stock...');
  try {
    const res = await ProductService.getLowStock();
    renderProductsTable(container, res.data || [], true);
  } catch (err) {
    showError(container, err.message);
  }
}

function renderProductsTable(container, data, lowStockMode = false) {
  const columns = [
    {
      key: 'image_url', label: '',
      render: (v) => v
        ? `<img src="${v}" style="width:36px;height:36px;object-fit:cover;border-radius:var(--radius);border:1px solid var(--border)" onerror="this.style.display='none'">`
        : `<div style="width:36px;height:36px;border-radius:var(--radius);border:1px dashed var(--border);background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:.9rem">🌺</div>`
    },
    { key: 'name', label: 'Producto' },
    { key: 'sku', label: 'SKU', render: (v) => v ? `<code style="font-family:var(--font-mono);font-size:.75rem;background:var(--bg-elevated);padding:.1rem .4rem;border-radius:.25rem">${v}</code>` : '—' },
    { key: 'category_name', label: 'Categoría' },
    { key: 'sell_price', label: 'Precio Venta', render: (v) => `<span style="color:var(--accent);font-weight:700;font-family:var(--font-mono)">${formatCurrency(v)}</span>` },
    { key: 'cost_price', label: 'Costo', render: (v) => `<span style="color:var(--text-muted)">${formatCurrency(v)}</span>` },
    {
      key: 'stock_cached', label: 'Stock',
      render: (v, row) => {
        const pct = Math.min(100, (v / Math.max(1, row.min_stock || 20)) * 100);
        const color = pct < 50 ? 'var(--red)' : pct < 80 ? 'var(--yellow)' : 'var(--green)';
        return `
          <div class="stock-bar-wrap">
            <span style="font-family:var(--font-mono);font-size:.8125rem;min-width:32px">${v}</span>
            <div class="stock-bar-bg"><div class="stock-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          </div>`;
      }
    },
    {
      key: 'is_active', label: 'Estado',
      render: (v) => v
        ? `<span class="status-badge status-active">● Activo</span>`
        : `<span class="status-badge status-inactive">● Inactivo</span>`
    },
    {
      key: 'show_in_catalog', label: 'Catálogo',
      render: (v, row) => `
        <button
          class="btn btn-sm ${v ? 'btn-success' : 'btn-ghost'}"
          style="font-size:.75rem;padding:.2rem .6rem;min-width:80px"
          onclick="window._productToggleCatalog(${row.id}, ${!v})"
          title="${v ? 'Visible en catálogo público — clic para ocultar' : 'Oculto del catálogo — clic para mostrar'}"
        >${v ? '👁 Visible' : '🚫 Oculto'}</button>`
    },
  ];

  const html = buildTable(columns, data, {
    emptyMsg: lowStockMode ? '✅ Sin productos con bajo stock' : 'No hay productos registrados',
    actions: (row) => `
      <div style="display:flex;gap:.375rem">
        <button class="btn btn-sm btn-ghost btn-icon" onclick="window._productEdit(${row.id})" title="Editar">✏️</button>
        ${row.is_active !== false
          ? `<button class="btn btn-sm btn-danger btn-icon" onclick="window._productDelete(${row.id})" title="Eliminar">🗑</button>`
          : `<button class="btn btn-sm btn-success btn-icon" onclick="window._productRestore(${row.id})" title="Restaurar">♻️</button>`
        }
      </div>
    `
  });

  container.innerHTML = html;
}

async function openProductForm(id) {
  let product = null;
  let categories = [];

  try {
    const [catRes, prodRes] = await Promise.allSettled([
      CategoryService.getAll(),
      id ? ProductService.getById(id) : Promise.resolve(null),
    ]);
    categories = catRes.status === 'fulfilled' ? catRes.value.data || [] : [];
    product = prodRes.status === 'fulfilled' && prodRes.value ? prodRes.value.data : null;
  } catch {}

  const fields = [
    { name: 'name', label: 'Nombre del Producto', required: true, placeholder: 'Ej: Rosa Roja Premium', span: 2 },
    { name: 'category_id', label: 'Categoría', type: 'select', required: true,
      options: categories.map(c => ({ value: c.id, label: c.name })) },
    { name: 'sku', label: 'SKU', placeholder: 'Ej: ROS-001' },
    { name: 'unit_of_measure', label: 'Unidad de Medida', required: true, placeholder: 'und, kg, litro...' },
    { name: 'cost_price', label: 'Precio de Costo (S/)', type: 'number', required: true, step: '0.01', min: '0' },
    { name: 'sell_price', label: 'Precio de Venta (S/)', type: 'number', required: true, step: '0.01', min: '0' },
    { name: 'stock_cached', label: 'Stock Inicial', type: 'number', min: '0', defaultValue: 0 },
    { name: 'min_stock', label: 'Stock Mínimo', type: 'number', min: '0', defaultValue: 0 },
    { name: 'description', label: 'Descripción', type: 'textarea', span: 2, placeholder: 'Descripción opcional...' },
  ];

  const formHTML = buildForm(fields, product || {}, {
    submitLabel: id ? 'Actualizar Producto' : 'Crear Producto',
    onCancel: closeModal,
  });

  // Build image section HTML
  const imageSection = `
    <div class="form-group" style="grid-column:span 2;margin-top:.25rem">
      <label class="form-label" style="display:flex;align-items:center;gap:.375rem">
        🖼️ Imagen del Producto
        <span style="font-size:.7rem;color:var(--text-muted);font-weight:400">(opcional)</span>
      </label>
      <div style="display:flex;gap:.75rem;align-items:flex-start">
        <div id="prod-img-preview" style="
          width:72px;height:72px;border-radius:var(--radius);border:2px dashed var(--border);
          background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;
          font-size:1.5rem;flex-shrink:0;overflow:hidden;transition:border-color .2s
        ">
          ${product?.image_url
            ? `<img src="${product.image_url}" style="width:100%;height:100%;object-fit:cover;border-radius:calc(var(--radius) - 2px)">`
            : '🌺'}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:.5rem">
          <input type="url" class="form-input" id="prod-image_url"
            value="${product?.image_url || ''}"
            placeholder="https://ejemplo.com/imagen.jpg">
          <p style="font-size:.75rem;color:var(--text-muted);margin:0">
            Pega la URL de la imagen. Acepta jpg, png, webp, etc.
          </p>
        </div>
      </div>
    </div>
  `;

  // Insert image section before the submit actions inside formHTML
  const formWithImage = formHTML.replace(
    '<div class="form-actions"',
    `${imageSection}<div class="form-actions"`
  );

  const modal = showModal({ title: id ? '✏️ Editar Producto' : '+ Nuevo Producto', content: formWithImage, size: 'md' });
  const form = modal.querySelector('#dynamic-form');

  // Live preview for image URL
  modal.querySelector('#prod-image_url')?.addEventListener('input', (e) => {
    const preview = modal.querySelector('#prod-img-preview');
    const url = e.target.value.trim();
    if (url) {
      preview.style.borderColor = 'var(--accent)';
      preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:calc(var(--radius) - 2px)"
        onerror="this.parentElement.innerHTML='❌';this.parentElement.style.borderColor='var(--red)'">`;
    } else {
      preview.style.borderColor = '';
      preview.innerHTML = '🌺';
    }
  });

  modal.querySelector('#form-cancel')?.addEventListener('click', closeModal);

  attachFormHandlers(form, async (data) => {
    // Pick image_url from the standalone input (not part of buildForm fields)
    const imageUrl = modal.querySelector('#prod-image_url')?.value.trim() || null;
    if (imageUrl) data.image_url = imageUrl;
    // else omit image_url entirely (not required)
    if (id) {
      await ProductService.update(id, data);
      Toast.success('Producto actualizado');
    } else {
      await ProductService.create(data);
      Toast.success('Producto creado');
    }
    closeModal();
    loadProducts();
  });
}

async function toggleProductCatalog(id, show) {
  try {
    await ProductService.toggleCatalog(id, show);
    Toast.success(show ? 'Producto visible en catálogo' : 'Producto oculto del catálogo');
    loadProducts();
  } catch (err) { Toast.error(err.message); }
}

async function deleteProduct(id) {
  if (!(await confirm('¿Eliminar este producto? Se puede restaurar posteriormente.', 'Eliminar Producto'))) return;
  try {
    await ProductService.delete(id);
    Toast.success('Producto eliminado');
    loadProducts();
  } catch (err) { Toast.error(err.message); }
}

async function restoreProduct(id) {
  try {
    await ProductService.restore(id);
    Toast.success('Producto restaurado');
    loadProducts();
  } catch (err) { Toast.error(err.message); }
}

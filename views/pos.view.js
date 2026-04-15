/**
 * Vista POS — Punto de Venta
 * ─────────────────────────────────────────────
 * Funcionalidades:
 *  • Grid de productos y recetas con búsqueda
 *  • Carrito con cantidad editable Y precio editable por ítem
 *  • Descuento personalizado (% o monto fijo) con preview en tiempo real
 *  • Nombre de cliente y método de pago
 *  • Ticket de venta con desglose completo
 *  • Payload correcto: discount_percentage enviado al backend
 */
import { ProductService, RecipeService, SaleService, CashboxService } from '../services/api.js';
import { formatCurrency, paymentLabel } from '../utils/helpers.js';
import { Toast, showModal, closeModal } from '../components/ui.js';
import Store from '../utils/store.js';

// ─── Estado del módulo ────────────────────────────────────────────────────────
let cart          = [];
let products      = [];
let recipes       = [];
let cashboxSession = null;
let discountType  = 'percent';   // 'percent' | 'fixed'
let discountValue = 0;

// ─── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
export async function renderPOS() {
  const main = document.getElementById('main-content');
  cart = [];
  discountValue = 0;
  discountType  = 'percent';

  main.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.75rem">
      <h1 class="page-title">🛒 Punto de Venta</h1>
      <div id="pos-cashbox-status" style="font-size:.875rem;color:var(--text-secondary)">Verificando caja...</div>
    </div>

    <div class="pos-layout" id="pos-main">

      <!-- ═══ COLUMNA IZQUIERDA: catálogo ════════════════ -->
      <div class="pos-products">

        <!-- Barra búsqueda + tabs -->
        <div style="display:flex;gap:.625rem;margin-bottom:.875rem;flex-wrap:wrap">
          <div class="search-input-wrap" style="flex:1;min-width:140px">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-input" id="pos-search" placeholder="Buscar por nombre o SKU...">
          </div>
          <div style="display:flex;gap:.375rem">
            <button class="btn btn-secondary btn-sm" id="tab-products"
              onclick="window._posTab('products')">🌺 Productos</button>
            <button class="btn btn-ghost btn-sm" id="tab-recipes"
              onclick="window._posTab('recipes')">💐 Recetas</button>
          </div>
        </div>

        <!-- Grid de ítems -->
        <div id="pos-catalog">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>

      <!-- ═══ COLUMNA DERECHA: carrito ════════════════════ -->
      <div class="pos-cart">

        <!-- Cabecera carrito -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
          <span style="font-size:1rem;font-weight:700">
            🧾 Carrito
            <span id="cart-count" style="font-size:.75rem;color:var(--text-muted);font-weight:400"></span>
          </span>
          <button class="btn btn-ghost btn-sm" onclick="window._posClearCart()">🗑 Vaciar</button>
        </div>

        <!-- Lista de ítems -->
        <div class="cart-items" id="cart-items">
          <div class="empty-state" style="padding:2rem">
            <div style="font-size:2rem">🛒</div>
            <p style="font-size:.875rem">Haz clic en un producto para agregarlo</p>
          </div>
        </div>

        <!-- ══ DESCUENTO ════════════════════════════════════ -->
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);padding:.75rem;margin-top:.5rem">

          <!-- Cabecera descuento -->
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
            <span style="font-size:.8125rem;font-weight:600;color:var(--text-secondary)">🏷️ Descuento</span>

            <!-- Toggle % / S/ -->
            <div style="margin-left:auto;display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
              <button id="disc-btn-pct"
                onclick="window._posSetDiscType('percent')"
                style="padding:.2rem .6rem;font-size:.75rem;font-weight:700;border:none;cursor:pointer;
                  background:var(--accent);color:#fff;transition:all .15s">%</button>
              <button id="disc-btn-fixed"
                onclick="window._posSetDiscType('fixed')"
                style="padding:.2rem .6rem;font-size:.75rem;font-weight:700;border:none;cursor:pointer;
                  background:transparent;color:var(--text-secondary);transition:all .15s">S/</button>
            </div>
          </div>

          <!-- Input + accesos rápidos -->
          <div style="display:flex;gap:.375rem;align-items:center">
            <div style="position:relative;flex:1">
              <input type="number" id="pos-discount" class="form-input"
                placeholder="0" min="0" value="0"
                style="padding-right:2.25rem;font-family:var(--font-mono);font-weight:700;font-size:.9375rem"
                oninput="window._posOnDiscInput(this.value)">
              <span id="disc-unit-label" style="
                position:absolute;right:.625rem;top:50%;transform:translateY(-50%);
                font-size:.8125rem;color:var(--text-muted);pointer-events:none;font-weight:600">%</span>
            </div>
            <!-- Accesos rápidos porcentaje -->
            <div id="disc-quick-btns" style="display:flex;gap:.25rem">
              ${[5,10,15,20].map(v => `
                <button onclick="window._posQuickDisc(${v})"
                  style="background:var(--bg-base);border:1px solid var(--border);color:var(--text-secondary);
                    padding:.25rem .4rem;border-radius:.375rem;font-size:.7rem;font-weight:600;cursor:pointer;
                    white-space:nowrap;transition:all .15s"
                  onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                  onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'"
                  >${v}%</button>
              `).join('')}
            </div>
          </div>

          <!-- Preview ahorro -->
          <div id="disc-preview" style="margin-top:.375rem;font-size:.8125rem;text-align:right;display:none"></div>
        </div>

        <!-- ══ TOTALES ═══════════════════════════════════════ -->
        <div class="cart-total" style="margin-top:.5rem">
          <div class="cart-total-row">
            <span>Subtotal</span>
            <span id="cart-subtotal" style="font-family:var(--font-mono)">S/ 0.00</span>
          </div>
          <div class="cart-total-row" id="disc-row" style="display:none;color:var(--green)">
            <span id="disc-row-label">Descuento</span>
            <span id="disc-amount-display" style="font-family:var(--font-mono)">-S/ 0.00</span>
          </div>
          <div class="cart-total-final">
            <span>TOTAL</span>
            <span id="cart-total-amount" style="font-family:var(--font-mono)">S/ 0.00</span>
          </div>
        </div>

        <!-- ══ DATOS VENTA ════════════════════════════════════ -->
        <div style="display:flex;flex-direction:column;gap:.5rem;margin-top:.625rem">
          <div class="form-group">
            <label class="form-label">Método de pago</label>
            <select class="form-input" id="pos-payment-method">
              <option value="cash">💵 Efectivo</option>
              <option value="yape">📱 Yape</option>
              <option value="plin">📱 Plin</option>
              <option value="card">💳 Tarjeta</option>
              <option value="transfer">🏦 Transferencia</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Cliente (opcional)</label>
            <div style="display:flex;gap:.375rem">
              <input type="text" class="form-input" id="pos-customer-id"
                placeholder="DNI / RUC" style="flex:1;min-width:0">
              <input type="text" class="form-input" id="pos-customer-name"
                placeholder="Nombre" style="flex:1.4;min-width:0">
            </div>
          </div>
        </div>

        <!-- Botón cobrar -->
        <button class="btn btn-primary btn-full" id="checkout-btn"
          onclick="window._posCheckout()"
          style="margin-top:.75rem;font-size:1rem;padding:.75rem 1rem;letter-spacing:.02em">
          💳 Cobrar
        </button>

      </div>
    </div>
  `;

  // ── Registrar callbacks globales ────────────────────────────────────────────
  window._posTab            = switchTab;
  window._posClearCart      = clearCart;
  window._posCheckout       = checkout;
  window._posUpdateQty      = updateQty;
  window._posUpdatePrice    = updateItemPrice;
  window._posRemoveItem     = removeItem;
  window._posAddToCart      = addToCart;
  window._posSetDiscType    = setDiscountType;
  window._posOnDiscInput    = (val) => { discountValue = parseFloat(val) || 0; recalcTotals(); };
  window._posQuickDisc      = (val) => {
    discountValue = val;
    const inp = document.getElementById('pos-discount');
    if (inp) inp.value = val;
    recalcTotals();
  };

  // Búsqueda en tiempo real
  const searchEl = document.getElementById('pos-search');
  let searchTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => filterCatalog(searchEl.value), 220);
  });

  await loadPOSData();
}

// ─── CARGA DE DATOS ───────────────────────────────────────────────────────────
async function loadPOSData() {
  // Estado de caja
  try {
    const res = await CashboxService.getStatus();
    cashboxSession = res.data?.session;
    const statusEl = document.getElementById('pos-cashbox-status');
    if (cashboxSession?.status === 'open') {
      statusEl.innerHTML = `<span style="color:var(--green)">✓ Caja #${cashboxSession.id} abierta</span>`;
      Store.set('cashbox', cashboxSession);
    } else {
      statusEl.innerHTML = `<span style="color:var(--red)">⚠ Sin caja — <a href="#/cashbox" style="color:var(--accent)">Abrir caja</a></span>`;
      const btn = document.getElementById('checkout-btn');
      if (btn) { btn.disabled = true; btn.title = 'Abre una caja primero'; }
    }
  } catch { /* no bloquea */ }

  // Catálogo
  try {
    const [prodsRes, recipesRes] = await Promise.all([
      ProductService.getAll({ limit: 300 }),
      RecipeService.getAvailable(),
    ]);
    products = prodsRes.data  || [];
    recipes  = recipesRes.data || [];
    renderCatalogGrid(products, 'product');
  } catch (err) {
    Toast.error('Error cargando catálogo: ' + err.message);
    const cat = document.getElementById('pos-catalog');
    if (cat) cat.innerHTML = '<div class="empty-state" style="padding:2rem">Error al cargar catálogo</div>';
  }
}

// ─── GRID CATÁLOGO ────────────────────────────────────────────────────────────
function renderCatalogGrid(items, type) {
  const container = document.getElementById('pos-catalog');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<div class="empty-state" style="padding:2.5rem">Sin ítems disponibles</div>';
    return;
  }

  const isProduct = (type === 'product');

  container.innerHTML = `<div class="products-grid">${items.map(item => {
    const stockVal = parseInt(item.stock_cached) || 0;
    const outOfStock = isProduct
      ? (stockVal <= 0)
      : (item.can_produce === false);

    const price = isProduct
      ? (item.sell_price ?? 0)
      : (item.sell_price ?? (item.total_cost ?? 0) * 1.5);

    const stockLabel = isProduct
      ? (outOfStock ? '❌ Sin stock' : `📦 ${stockVal}`)
      : (outOfStock ? '❌ Sin stock' : (item.max_quantity ? `✓ Máx: ${item.max_quantity}` : '✓ Disponible'));

    const hasImage = item.image_url && item.image_url.trim() && item.image_url !== 'null';
    const iconEmoji = isProduct ? '🌺' : '💐';

    // Serializar para atributo data-* (seguro contra comillas)
    const safeJson = JSON.stringify(item)
      .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    return `<div
        class="product-card-pos${outOfStock ? ' out-of-stock' : ''}"
        data-type="${type}"
        data-item="${safeJson}"
        ${!outOfStock ? 'onclick="window._posClickCard(this)"' : ''}
        title="${outOfStock ? 'Sin stock disponible' : `Agregar: ${item.name}`}">
        ${hasImage 
          ? `<div class="product-img-pos"><img src="${item.image_url}" alt="${escHtml(item.name)}" onerror="this.outerHTML='<span class=\\'product-icon\\'>${iconEmoji}</span>'"></div>` 
          : `<div class="product-icon">${iconEmoji}</div>`}
        <div class="product-name">${escHtml(item.name)}</div>
        <div class="product-price">${formatCurrency(price)}</div>
        <div class="product-stock">${stockLabel}</div>
      </div>`;
  }).join('')}</div>`;

  // Un solo handler delegado — más eficiente que onclick inline con JSON
  window._posClickCard = (el) => {
    const rawJson = el.dataset.item.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
    addToCart(el.dataset.type, rawJson);
  };
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  const btnP = document.getElementById('tab-products');
  const btnR = document.getElementById('tab-recipes');
  if (tab === 'products') {
    btnP.className = 'btn btn-secondary btn-sm';
    btnR.className = 'btn btn-ghost btn-sm';
    filterCatalog(document.getElementById('pos-search').value, 'product');
  } else {
    btnR.className = 'btn btn-secondary btn-sm';
    btnP.className = 'btn btn-ghost btn-sm';
    renderCatalogGrid(recipes, 'recipe');
  }
}

function filterCatalog(query, forcedType) {
  const isRecipesTab = document.getElementById('tab-recipes')?.classList.contains('btn-secondary');
  const type         = forcedType ?? (isRecipesTab ? 'recipe' : 'product');
  const source       = type === 'product' ? products : recipes;
  if (!query.trim()) { renderCatalogGrid(source, type); return; }
  const q = query.toLowerCase();
  renderCatalogGrid(
    source.filter(i => i.name.toLowerCase().includes(q) || (i.sku ?? '').toLowerCase().includes(q)),
    type
  );
}

// ─── CARRITO — OPERACIONES ────────────────────────────────────────────────────
function addToCart(type, itemJsonStr) {
  let item;
  try { item = JSON.parse(itemJsonStr); }
  catch { Toast.error('No se pudo leer el producto'); return; }

  const key      = `${type[0]}-${item.id}`;
  const existing = cart.find(c => c._key === key);

  if (existing) {
    existing.quantity += 1;
  } else {
    const basePrice = type === 'product'
      ? (Number(item.sell_price) || 0)
      : (Number(item.sell_price) || (Number(item.total_cost) || 0) * 1.5);

    cart.push({
      _key:       key,
      type,
      id:         item.id,
      name:       item.name,
      price:      basePrice,
      basePrice,
      cost:       item.cost_price ?? item.total_cost ?? 0,
      quantity:   1,
    });
  }

  renderCart();
  flashCard(item.id, type);
}

function updateQty(key, delta) {
  const item = cart.find(c => c._key === key);
  if (!item) return;
  const next = item.quantity + delta;
  if (next < 1) { removeItem(key); return; }
  item.quantity = next;
  renderCart();
}

function updateItemPrice(key, rawVal) {
  const item = cart.find(c => c._key === key);
  if (!item) return;
  const val = parseFloat(rawVal);
  if (!isNaN(val) && val >= 0) {
    item.price = val;
    recalcTotals(); // no re-renderiza el carrito entero, solo los totales
  }
}

function removeItem(key) {
  cart = cart.filter(c => c._key !== key);
  renderCart();
}

function clearCart() {
  cart = [];
  discountValue = 0;
  const inp = document.getElementById('pos-discount');
  if (inp) inp.value = 0;
  renderCart();
}

// ─── RENDER CARRITO ───────────────────────────────────────────────────────────
function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl   = document.getElementById('cart-count');
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:2rem">
        <div style="font-size:2rem">🛒</div>
        <p style="font-size:.875rem">Haz clic en un producto para agregarlo</p>
      </div>`;
    if (countEl) countEl.textContent = '';
    recalcTotals();
    return;
  }

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  if (countEl) countEl.textContent = ` (${totalItems} ítem${totalItems !== 1 ? 's' : ''})`;

  container.innerHTML = cart.map(item => `
    <div class="cart-item" data-key="${item._key}">

      <!-- Info producto -->
      <div style="flex:1;min-width:0">
        <div style="font-size:.8125rem;font-weight:600;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.25rem"
          title="${escHtml(item.name)}">${escHtml(item.name)}</div>

        <!-- Fila precio editable + subtotal -->
        <div style="display:flex;align-items:center;gap:.375rem;flex-wrap:nowrap">
          <span style="font-size:.75rem;color:var(--text-muted);flex-shrink:0">S/</span>
          <input
            type="number"
            value="${item.price.toFixed(2)}"
            min="0"
            step="0.10"
            class="form-input"
            title="Precio unitario (editable)"
            onchange="window._posUpdatePrice('${item._key}', this.value)"
            style="width:72px;padding:.2rem .375rem;font-size:.8125rem;
              font-family:var(--font-mono);font-weight:700;color:var(--accent);
              text-align:right;flex-shrink:0">
          <span style="font-size:.75rem;color:var(--text-muted);flex-shrink:0">× ${item.quantity}</span>
          <span style="font-size:.8125rem;font-weight:700;
            font-family:var(--font-mono);color:var(--text-primary);
            margin-left:auto;flex-shrink:0">
            ${formatCurrency(item.price * item.quantity)}
          </span>
        </div>
      </div>

      <!-- Controles cantidad -->
      <div class="cart-qty-ctrl" style="flex-shrink:0;margin-left:.5rem;gap:.25rem">
        <button class="cart-qty-btn"
          onclick="window._posUpdateQty('${item._key}',-1)" title="Quitar uno">−</button>
        <span class="cart-qty-val" style="min-width:22px">${item.quantity}</span>
        <button class="cart-qty-btn"
          onclick="window._posUpdateQty('${item._key}',1)" title="Agregar uno">+</button>
        <button class="cart-qty-btn"
          onclick="window._posRemoveItem('${item._key}')"
          style="color:var(--red)" title="Eliminar">🗑</button>
      </div>
    </div>
  `).join('');

  recalcTotals();
}

// ─── DESCUENTO ────────────────────────────────────────────────────────────────
function setDiscountType(type) {
  discountType  = type;
  discountValue = 0;

  const inp       = document.getElementById('pos-discount');
  const unitLabel = document.getElementById('disc-unit-label');
  const quickBtns = document.getElementById('disc-quick-btns');
  const btnPct    = document.getElementById('disc-btn-pct');
  const btnFixed  = document.getElementById('disc-btn-fixed');

  if (inp) { inp.value = 0; inp.max = type === 'percent' ? '100' : ''; inp.step = type === 'percent' ? '1' : '0.5'; }
  if (unitLabel) unitLabel.textContent = type === 'percent' ? '%' : 'S/';
  if (quickBtns) quickBtns.style.display = type === 'percent' ? 'flex' : 'none';

  if (btnPct && btnFixed) {
    const active   = { background: 'var(--accent)', color: '#fff' };
    const inactive = { background: 'transparent',   color: 'var(--text-secondary)' };
    const [aBtn, iBtn] = type === 'percent' ? [btnPct, btnFixed] : [btnFixed, btnPct];
    Object.assign(aBtn.style, active);
    Object.assign(iBtn.style, inactive);
  }

  recalcTotals();
}

function calcDiscount(subtotal) {
  if (!discountValue || discountValue <= 0 || !subtotal) return 0;
  if (discountType === 'percent') return subtotal * (Math.min(discountValue, 100) / 100);
  return Math.min(discountValue, subtotal);
}

/** Devuelve el % efectivo del descuento, para mandarlo al backend */
function effectiveDiscountPercent(subtotal) {
  if (!subtotal) return 0;
  if (discountType === 'percent') return Math.min(discountValue, 100);
  const amount = calcDiscount(subtotal);
  return (amount / subtotal) * 100;
}

// ─── RECALCULAR TOTALES (sin re-renderizar el carrito) ────────────────────────
function recalcTotals() {
  const subtotal   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discAmount = calcDiscount(subtotal);
  const total      = Math.max(0, subtotal - discAmount);

  const byId = (id) => document.getElementById(id);

  // Subtotal
  if (byId('cart-subtotal')) byId('cart-subtotal').textContent = formatCurrency(subtotal);

  // Fila de descuento
  if (discAmount > 0 && cart.length) {
    if (byId('disc-row')) byId('disc-row').style.display = '';
    if (byId('disc-row-label')) byId('disc-row-label').textContent =
      discountType === 'percent'
        ? `Descuento (${discountValue}%)`
        : `Descuento (S/ ${Number(discountValue).toFixed(2)})`;
    if (byId('disc-amount-display')) byId('disc-amount-display').textContent = `-${formatCurrency(discAmount)}`;
    if (byId('disc-preview')) {
      byId('disc-preview').style.display = '';
      byId('disc-preview').innerHTML = `<span style="color:var(--green);font-weight:600">💚 Ahorro: ${formatCurrency(discAmount)}</span>`;
    }
  } else {
    if (byId('disc-row'))    byId('disc-row').style.display    = 'none';
    if (byId('disc-preview')) byId('disc-preview').style.display = 'none';
  }

  // Total final
  if (byId('cart-total-amount')) {
    byId('cart-total-amount').textContent = formatCurrency(total);
    byId('cart-total-amount').style.color = discAmount > 0 ? 'var(--green)' : '';
  }
}

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────
async function checkout() {
  if (!cart.length)      { Toast.warning('El carrito está vacío'); return; }
  if (!cashboxSession)   { Toast.error('No hay caja abierta. Ve a Caja → Abrir Caja.'); return; }

  const user          = Store.get('user');
  const paymentMethod = document.getElementById('pos-payment-method').value;
  const customerId    = document.getElementById('pos-customer-id').value.trim();
  const customerName  = document.getElementById('pos-customer-name').value.trim();

  const subtotal    = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discAmount  = calcDiscount(subtotal);
  const discPct     = effectiveDiscountPercent(subtotal);
  const totalFinal  = Math.max(0, subtotal - discAmount);

  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.5rem">
    <span class="spinner spinner-sm"></span> Procesando...
  </span>`;

  try {
    // ── Payload completo al backend ──────────────────────────────────────────
    const saleData = {
      user_id:             user.id,
      cashbox_id:          cashboxSession.id,
      total_amount:        parseFloat(totalFinal.toFixed(2)),
      payment_method_id:   1,
      discount_percentage: parseFloat(discPct.toFixed(4)),
      items: cart.map(item => ({
        ...(item.type === 'product' ? { product_id: item.id } : { recipe_id: item.id }),
        quantity: item.quantity,
        price:    parseFloat((Number(item.price) || 0).toFixed(2)),
        cost:     parseFloat((Number(item.cost) || 0).toFixed(2)),
        name:     item.name,
      })),
    };
    if (customerId)   saleData.customer_identifier = customerId;
    if (customerName) saleData.customer_name       = customerName;

    const res = await SaleService.quickSale(saleData);

    Toast.success(`✅ Venta registrada — ${formatCurrency(totalFinal)}`);

    // Snapshot del carrito antes de limpiarlo (para el ticket)
    const snap = cart.map(i => ({ ...i }));
    clearCart();
    clearSaleFields();
    showTicket(res.data, snap, subtotal, discAmount, discPct, totalFinal, paymentMethod, customerName || customerId);

  } catch (err) {
    Toast.error('Error: ' + (err.message || 'No se pudo procesar la venta'));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '💳 Cobrar';
  }
}

function clearSaleFields() {
  ['pos-customer-id','pos-customer-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  discountValue = 0;
  const inp = document.getElementById('pos-discount');
  if (inp) inp.value = 0;
  recalcTotals();
}

// ─── TICKET ───────────────────────────────────────────────────────────────────
function showTicket(saleData, cartSnap, subtotal, discAmount, discPct, total, payMethod, clientLabel) {
  showModal({
    title: '🧾 Comprobante de Venta',
    size: 'sm',
    content: `
      <div style="font-family:var(--font-mono);font-size:.8125rem;max-width:300px;margin:0 auto">

        <!-- Encabezado -->
        <div style="text-align:center;padding-bottom:.875rem;border-bottom:2px dashed var(--border)">
          <div style="font-size:2rem;line-height:1.1">🌸</div>
          <div style="font-size:1rem;font-weight:700;margin:.2rem 0">FLORERÍA ADMIN</div>
          <div style="color:var(--text-secondary);font-size:.75rem">${new Date().toLocaleString('es-PE')}</div>
          ${saleData?.id ? `<div style="color:var(--text-muted);font-size:.75rem">Venta #${saleData.id}</div>` : ''}
          ${clientLabel ? `<div style="margin-top:.25rem;font-size:.75rem">Cliente: <b>${escHtml(clientLabel)}</b></div>` : ''}
        </div>

        <!-- Ítems -->
        <div style="padding:.75rem 0;border-bottom:1px dashed var(--border)">
          ${cartSnap.map(i => `
            <div style="display:flex;justify-content:space-between;gap:.5rem;padding:.15rem 0">
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(i.name)}</span>
              <span style="flex-shrink:0;color:var(--text-muted)">×${i.quantity} @${formatCurrency(i.price)}</span>
              <span style="flex-shrink:0;font-weight:700">${formatCurrency(i.price * i.quantity)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Totales -->
        <div style="padding:.75rem 0">
          <div style="display:flex;justify-content:space-between;color:var(--text-secondary);padding:.15rem 0">
            <span>Subtotal</span><span>${formatCurrency(subtotal)}</span>
          </div>
          ${discAmount > 0 ? `
            <div style="display:flex;justify-content:space-between;color:var(--green);padding:.15rem 0">
              <span>Descuento (${discPct.toFixed(1)}%)</span>
              <span>-${formatCurrency(discAmount)}</span>
            </div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:800;
            padding:.5rem 0;border-top:2px solid var(--border);margin-top:.25rem">
            <span>TOTAL</span>
            <span style="color:var(--green)">${formatCurrency(total)}</span>
          </div>
          <div style="text-align:center;color:var(--text-secondary);font-size:.75rem;margin-top:.2rem">
            Pago: ${paymentLabel(payMethod)}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;border-top:1px dashed var(--border);padding-top:.625rem">
          <div style="font-size:1.5rem">✅</div>
          <div style="color:var(--green);font-weight:700;font-size:.875rem">¡Gracias por su compra!</div>
        </div>
      </div>

      <div style="text-align:center;margin-top:1rem">
        <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ Imprimir</button>
      </div>
    `,
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function flashCard(itemId, type) {
  document.querySelectorAll('.product-card-pos').forEach(card => {
    try {
      const raw  = card.dataset.item?.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
      const data = JSON.parse(raw || '{}');
      if (card.dataset.type === type && String(data.id) === String(itemId)) {
        card.style.transform  = 'scale(1.06)';
        card.style.borderColor = 'var(--accent)';
        card.style.boxShadow  = '0 0 14px rgba(232,135,106,.4)';
        setTimeout(() => {
          card.style.transform  = '';
          card.style.borderColor = '';
          card.style.boxShadow  = '';
        }, 200);
      }
    } catch {}
  });
}

/* =============================================
   ENCANTOS ETERNOS — JS Global
   ============================================= */

const API_BASE = 'http://localhost:3000/api';
const WA_NUMBER = '51972542802';

/* ── Auth ── */
const Auth = {
  getToken: () => localStorage.getItem('ee_token'),
  getUser:  () => JSON.parse(localStorage.getItem('ee_user') || 'null'),
  setSession: (token, user) => {
    localStorage.setItem('ee_token', token);
    localStorage.setItem('ee_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('ee_token');
    localStorage.removeItem('ee_user');
  },
  isLogged: () => !!localStorage.getItem('ee_token'),
  hasRole: (roles) => {
    const user = Auth.getUser();
    if (!user) return false;
    return Array.isArray(roles) ? roles.includes(user.rol) : user.rol === roles;
  }
};

/* ── API Helper ── */
const API = {
  headers: () => ({
    'Content-Type': 'application/json',
    ...(Auth.getToken() ? { Authorization: `Bearer ${Auth.getToken()}` } : {})
  }),

  get: async (endpoint) => {
    const r = await fetch(API_BASE + endpoint, { headers: API.headers() });
    if (r.status === 401) { Auth.clear(); window.location.href = '/pages/admin/login.html'; }
    if (!r.ok) {
      const errorData = await r.json();
      throw new Error(errorData.mensaje || errorData.error || 'Error en la solicitud');
    }
    return r.json();
  },

  post: async (endpoint, data) => {
    const r = await fetch(API_BASE + endpoint, {
      method: 'POST', headers: API.headers(), body: JSON.stringify(data)
    });
    if (!r.ok) {
      const errorData = await r.json();
      
      // Crear un error más detallado que preserve la respuesta
      const error = new Error('Errores de validación');
      error.response = {
        status: r.status,
        statusText: r.statusText,
        data: errorData
      };
      
      // Si hay errores de validación detallados, mostrarlos
      if (errorData.errores && Array.isArray(errorData.errores)) {
        const detalles = errorData.errores.map(e => e.msg).join(', ');
        error.message = `Errores de validación: ${detalles}`;
      } else if (errorData.detalles && Array.isArray(errorData.detalles)) {
        // Manejar diferentes formatos de detalles
        const detalles = errorData.detalles.map(d => {
          if (typeof d === 'string') return d;
          if (d.msg) return d.msg;
          if (d.message) return d.message;
          return JSON.stringify(d);
        }).join(', ');
        error.message = `Errores de validación: ${detalles}`;
      } else if (errorData.mensaje || errorData.error) {
        error.message = errorData.mensaje || errorData.error;
      }
      
      throw error;
    }
    return r.json();
  },

  put: async (endpoint, data) => {
    const r = await fetch(API_BASE + endpoint, {
      method: 'PUT', headers: API.headers(), body: JSON.stringify(data)
    });
    if (!r.ok) {
      const errorData = await r.json();
      throw new Error(errorData.mensaje || errorData.error || 'Error en la solicitud');
    }
    return r.json();
  },

  delete: async (endpoint) => {
    const r = await fetch(API_BASE + endpoint, { method: 'DELETE', headers: API.headers() });
    if (!r.ok) {
      const errorData = await r.json();
      throw new Error(errorData.mensaje || errorData.error || 'Error en la solicitud');
    }
    return r.json();
  },

  postForm: async (endpoint, formData) => {
    const r = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { ...(Auth.getToken() ? { Authorization: `Bearer ${Auth.getToken()}` } : {}) },
      body: formData
    });
    return r.json();
  }
};

/* ── Toast ── */
const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(msg, type = 'default', duration = 3500) {
    this.init();
    const icons = { success: '✓', warning: '!', danger: '✕', default: '•' };
    const colors = { success: '#2D8C4E', warning: '#C87B1A', danger: '#C43232', default: '#CC3870' };
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderLeft = `3px solid ${colors[type]}`;
    t.innerHTML = `<span style="color:${colors[type]};font-weight:700">${icons[type]}</span> ${msg}`;
    this.container.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastIn .3s ease reverse';
      setTimeout(() => t.remove(), 280);
    }, duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  warning: (msg) => Toast.show(msg, 'warning'),
  error:   (msg) => Toast.show(msg, 'danger'),
  info:    (msg) => Toast.show(msg, 'default'),
};

/* ── Modal ── */
const Modal = {
  open(id) { 
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('active');
    } else {
      console.error('Modal no encontrado:', id);
    }
  },
  close(id) { 
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
    }
  },
  confirm(msg, onConfirm) {
    const id = 'modal-confirm-' + Date.now();
    const m = document.createElement('div');
    m.className = 'modal-overlay active';
    m.id = id;
    m.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-body" style="padding:1.5rem;text-align:center">
          <div style="font-size:36px;margin-bottom:12px">⚠️</div>
          <p style="font-weight:500;margin-bottom:8px">¿Estás seguro?</p>
          <p style="font-size:13px;color:var(--gris-500);margin-bottom:1.5rem">${msg}</p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button class="btn btn-ghost btn-sm" onclick="Modal.close('${id}');this.closest('.modal-overlay').remove()">Cancelar</button>
            <button class="btn btn-primary btn-sm" id="confirm-ok-${id}">Confirmar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);
    document.getElementById(`confirm-ok-${id}`).addEventListener('click', () => {
      onConfirm(); m.remove();
    });
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  },
  alert(title, content) {
    const id = 'modal-alert-' + Date.now();
    const m = document.createElement('div');
    m.className = 'modal-overlay active';
    m.id = id;
    m.innerHTML = `
      <div class="modal" style="max-width:480px">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body" style="padding:1.5rem">
          ${content}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-overlay').remove()">Entendido</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  }
};

/* ── WhatsApp ── */
const WhatsApp = {
  send(msg, numero = WA_NUMBER) {
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },
  arregloMsg(flores, precioTotal, cliente = '', direccion = '') {
    let msg = `🌸 *Pedido - Detalles y Regalos Encantos Eternos*\n\n`;
    msg += `*Arreglo personalizado:*\n`;
    flores.forEach(f => { msg += `• ${f.nombre}: ${f.cantidad} unid.\n`; });
    msg += `\n💰 *Precio estimado: S/ ${precioTotal.toFixed(2)}*\n`;
    if (cliente)   msg += `\n👤 Cliente: ${cliente}`;
    if (direccion) msg += `\n📍 Dirección: ${direccion}`;
    msg += `\n\n_Mensaje generado desde nuestro laboratorio de flores_`;
    return msg;
  }
};

/* ── Formatters ── */
const Fmt = {
  moneda: (n) => `S/ ${parseFloat(n || 0).toFixed(2)}`,
  fecha: (d) => new Date(d).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' }),
  fechaHora: (d) => new Date(d).toLocaleString('es-PE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
  tel: (t) => t ? t.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') : '',
  porcentaje: (n) => `${parseFloat(n || 0).toFixed(1)}%`,
  nro: (n) => parseInt(n || 0).toLocaleString('es-PE'),
};

/* ── Dark Mode ── */
const DarkMode = {
  init() {
    if (localStorage.getItem('ee_dark') === '1') {
      document.body.classList.add('dark-mode');
    }
    this.updateBtn();
  },
  toggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('ee_dark', isDark ? '1' : '0');
    this.updateBtn();
  },
  updateBtn() {
    const isDark = document.body.classList.contains('dark-mode');
    document.querySelectorAll('.btn-dark-toggle, #btn-dark').forEach(btn => {
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Modo claro' : 'Modo oscuro';
    });
  }
};

function toggleDark() { DarkMode.toggle(); }

document.addEventListener('DOMContentLoaded', () => DarkMode.init());

/* ── Debounce ── */
function debounce(fn, delay = 350) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ── Init: cerrar modales al click fuera ── */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// splash
window.addEventListener("load", function() {
  setTimeout(function() {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.style.opacity = "0";
      splash.style.transition = "opacity 0.5s ease";

      setTimeout(function() {
        splash.style.display = "none";
      }, 500);
    }
  }, 1500);
});
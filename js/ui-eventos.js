/**
 * UI-EVENTOS.JS - Renderizado y manipulación del DOM
 * Funciones para mostrar eventos en la interfaz
 */

const UIEventos = {
  /**
   * Renderizar lista de eventos en el panel admin
   */
  renderizarListaAdmin(eventos, contenedor) {
    if (!contenedor) return;

    if (eventos.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--gris-400)">
          <div style="font-size:48px;margin-bottom:1rem">📅</div>
          <p>No hay eventos creados</p>
          <p style="font-size:13px;margin-top:8px">Crea tu primer evento usando el formulario</p>
        </div>
      `;
      return;
    }

    contenedor.innerHTML = eventos.map(evento => this.crearCardAdmin(evento)).join('');
  },

  /**
   * Crear card de evento para panel admin
   */
  crearCardAdmin(evento) {
    // Parsear metadata si existe - PostgreSQL devuelve JSONB como objeto
    let metadata = {};
    if (evento.metadata) {
      if (typeof evento.metadata === 'object') {
        metadata = evento.metadata;
      } else {
        try {
          metadata = JSON.parse(evento.metadata);
        } catch (e) {
          console.warn('No se pudo parsear metadata:', e);
        }
      }
    }

    const precioOriginal = metadata.precioOriginal || 0;
    const precioFinal = metadata.precioFinal || 0;
    const productos = metadata.productos || [];
    const imagen = metadata.imagen || '';

    const descuento = Eventos.calcularDescuento(precioOriginal, precioFinal);
    const diasRestantes = Eventos.diasRestantes(evento.fecha);
    const fechaFormateada = Eventos.formatearFecha(evento.fecha);

    return `
      <div class="card" style="padding:1.25rem;margin-bottom:1rem">
        <div style="display:flex;gap:1rem;align-items:start">
          <!-- Imagen -->
          <div style="flex-shrink:0">
            <img src="${imagen}" 
                 alt="${evento.nombre}" 
                 style="width:120px;height:120px;object-fit:cover;border-radius:8px"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect fill=%22%23f0e8f5%22 width=%22120%22 height=%22120%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22%3E🌸%3C/text%3E%3C/svg%3E'" />
          </div>

          <!-- Contenido -->
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
              <div>
                <h3 style="margin:0;font-size:18px;color:var(--gris-900)">${evento.emoji || '🌸'} ${evento.nombre}</h3>
                <p style="margin:4px 0 0 0;font-size:13px;color:var(--gris-600)">${fechaFormateada}</p>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-outline" onclick="editarEvento('${evento.id}')" title="Editar">
                  ✏️
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmarEliminarEvento('${evento.id}')" title="Eliminar">
                  🗑️
                </button>
              </div>
            </div>

            <!-- Badges -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
              <span class="badge ${diasRestantes <= 7 ? 'badge-warning' : 'badge-success'}">
                ${diasRestantes === 0 ? '¡Hoy!' : diasRestantes === 1 ? 'Mañana' : `En ${diasRestantes} días`}
              </span>
              ${descuento > 0 ? `<span class="badge badge-danger">${descuento}% OFF</span>` : ''}
              <span class="badge badge-gray">${productos.length} producto(s)</span>
            </div>

            <!-- Productos -->
            ${productos.length > 0 ? `
            <div style="font-size:12px;color:var(--gris-600);margin-bottom:8px">
              <strong>Productos:</strong> ${productos.map(p => p.nombre).join(', ')}
            </div>
            ` : ''}

            <!-- Precios -->
            ${precioOriginal > 0 && precioFinal > 0 ? `
            <div style="display:flex;gap:12px;align-items:center">
              <span style="text-decoration:line-through;color:var(--gris-400);font-size:14px">
                S/ ${precioOriginal.toFixed(2)}
              </span>
              <span style="font-size:20px;font-weight:700;color:var(--rosa-500)">
                S/ ${precioFinal.toFixed(2)}
              </span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Renderizar eventos en index.html (página pública)
   */
  renderizarEventosPublicos(eventos, contenedor) {
    if (!contenedor) return;

    if (eventos.length === 0) {
      contenedor.innerHTML = '<div style="text-align:center;padding:2rem;color:#b8a8c8">No hay eventos próximos</div>';
      return;
    }

    contenedor.innerHTML = eventos.map(evento => this.crearCardPublico(evento)).join('');
  },

  /**
   * Crear card de evento para página pública
   */
  crearCardPublico(evento) {
    // Parsear metadata si existe - PostgreSQL devuelve JSONB como objeto
    let metadata = {};
    if (evento.metadata) {
      if (typeof evento.metadata === 'object') {
        metadata = evento.metadata;
      } else {
        try {
          metadata = JSON.parse(evento.metadata);
        } catch (e) {
          console.warn('No se pudo parsear metadata:', e);
        }
      }
    }

    const precioOriginal = metadata.precioOriginal || 0;
    const precioFinal = metadata.precioFinal || 0;
    const productos = metadata.productos || [];
    const imagen = metadata.imagen || '';

    const descuento = Eventos.calcularDescuento(precioOriginal, precioFinal);
    const diasRestantes = Eventos.diasRestantes(evento.fecha);
    const fechaFormateada = new Date(evento.fecha).toLocaleDateString('es-PE', { 
      day: '2-digit', 
      month: 'short' 
    });

    return `
      <div class="promo-card" onclick="pedirEvento('${evento.nombre.replace(/'/g, "\\'")}', ${precioFinal})">
        <!-- Badge de descuento -->
        ${descuento > 0 ? `<div class="promo-tag">-${descuento}% OFF</div>` : ''}
        
        <!-- Imagen -->
        <div class="promo-img">
          <img src="${imagen}" 
               alt="${evento.nombre}"
               style="width:100%;height:100%;object-fit:cover"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:64px;background:#f0e8f5">
            ${evento.emoji || '🌸'}
          </div>
        </div>

        <!-- Contenido -->
        <div class="promo-body">
          <div class="promo-emoji">${evento.emoji || '🌸'}</div>
          <div class="promo-title">${evento.nombre}</div>
          <div class="promo-date">📅 ${fechaFormateada}</div>
          
          ${diasRestantes <= 7 ? `
            <div style="background:rgba(245,158,11,0.1);color:#f59e0b;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;text-align:center;margin:8px 0">
              ${diasRestantes === 0 ? '¡HOY!' : diasRestantes === 1 ? '¡MAÑANA!' : `¡FALTAN ${diasRestantes} DÍAS!`}
            </div>
          ` : ''}

          <!-- Productos incluidos -->
          ${productos.length > 0 ? `
          <div style="font-size:11px;color:var(--gris-600);margin:8px 0;line-height:1.5">
            <strong>Incluye:</strong><br>
            ${productos.slice(0, 3).map(p => `• ${p.nombre}`).join('<br>')}
            ${productos.length > 3 ? `<br>• Y ${productos.length - 3} más...` : ''}
          </div>
          ` : ''}

          <!-- Precios -->
          ${precioOriginal > 0 && precioFinal > 0 ? `
          <div class="promo-price">
            <span class="promo-price-old">S/ ${precioOriginal.toFixed(2)}</span>
            <span class="promo-price-new">S/ ${precioFinal.toFixed(2)}</span>
          </div>
          ` : ''}

          <button class="btn btn-primary" style="width:100%;margin-top:8px">
            📱 Pedir por WhatsApp
          </button>
        </div>
      </div>
    `;
  },

  /**
   * Mostrar mensaje de éxito
   */
  mostrarExito(mensaje) {
    if (typeof Toast !== 'undefined') {
      Toast.success(mensaje);
    } else {
      alert(mensaje);
    }
  },

  /**
   * Mostrar mensaje de error
   */
  mostrarError(mensaje) {
    if (typeof Toast !== 'undefined') {
      Toast.error(mensaje);
    } else {
      alert(mensaje);
    }
  },

  /**
   * Mostrar mensaje de advertencia
   */
  mostrarAdvertencia(mensaje) {
    if (typeof Toast !== 'undefined') {
      Toast.warning(mensaje);
    } else {
      alert(mensaje);
    }
  }
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIEventos;
}

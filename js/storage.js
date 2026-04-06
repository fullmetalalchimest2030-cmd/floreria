/**
 * STORAGE.JS - Manejo de localStorage para eventos
 * Sistema de persistencia frontend para eventos especiales
 */

const Storage = {
  KEYS: {
    EVENTOS: 'ee_eventos',
    PRODUCTOS: 'ee_productos_cache'
  },

  /**
   * Guardar eventos en localStorage
   */
  guardarEventos(eventos) {
    try {
      localStorage.setItem(this.KEYS.EVENTOS, JSON.stringify(eventos));
      return true;
    } catch (error) {
      console.error('Error al guardar eventos:', error);
      return false;
    }
  },

  /**
   * Obtener todos los eventos
   */
  obtenerEventos() {
    try {
      const data = localStorage.getItem(this.KEYS.EVENTOS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error al obtener eventos:', error);
      return [];
    }
  },

  /**
   * Obtener un evento por ID
   */
  obtenerEventoPorId(id) {
    const eventos = this.obtenerEventos();
    return eventos.find(e => e.id === id);
  },

  /**
   * Crear nuevo evento
   */
  crearEvento(evento) {
    const eventos = this.obtenerEventos();
    const nuevoEvento = {
      id: Date.now().toString(),
      ...evento,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    eventos.push(nuevoEvento);
    this.guardarEventos(eventos);
    return nuevoEvento;
  },

  /**
   * Actualizar evento existente
   */
  actualizarEvento(id, datosActualizados) {
    const eventos = this.obtenerEventos();
    const index = eventos.findIndex(e => e.id === id);
    
    if (index === -1) {
      return null;
    }

    eventos[index] = {
      ...eventos[index],
      ...datosActualizados,
      updatedAt: Date.now()
    };

    this.guardarEventos(eventos);
    return eventos[index];
  },

  /**
   * Eliminar evento
   */
  eliminarEvento(id) {
    const eventos = this.obtenerEventos();
    const eventosFiltrados = eventos.filter(e => e.id !== id);
    this.guardarEventos(eventosFiltrados);
    return eventosFiltrados.length < eventos.length;
  },

  /**
   * Obtener eventos futuros (fecha >= hoy)
   */
  obtenerEventosFuturos() {
    const eventos = this.obtenerEventos();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return eventos
      .filter(e => {
        const fechaEvento = new Date(e.fecha);
        return fechaEvento >= hoy;
      })
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  },

  /**
   * Verificar si existe un evento en una fecha
   */
  existeEventoEnFecha(fecha, idExcluir = null) {
    const eventos = this.obtenerEventos();
    return eventos.some(e => e.fecha === fecha && e.id !== idExcluir);
  },

  /**
   * Limpiar todos los eventos (útil para testing)
   */
  limpiarEventos() {
    localStorage.removeItem(this.KEYS.EVENTOS);
  }
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}

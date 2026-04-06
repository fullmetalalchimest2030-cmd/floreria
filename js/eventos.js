/**
 * EVENTOS.JS - Lógica de negocio para eventos
 * Manejo de validaciones y operaciones de eventos
 */

const Eventos = {
  /**
   * Validar datos de evento
   */
  validar(datos) {
    const errores = [];

    // Validar fecha
    if (!datos.fecha) {
      errores.push('La fecha es obligatoria');
    } else {
      const fechaEvento = new Date(datos.fecha);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      if (fechaEvento < hoy) {
        errores.push('La fecha no puede ser anterior a hoy');
      }
    }

    // Validar nombre
    if (!datos.nombre || datos.nombre.trim() === '') {
      errores.push('El nombre del evento es obligatorio');
    }

    // Validar imagen
    if (!datos.imagen || datos.imagen.trim() === '') {
      errores.push('La URL de la imagen es obligatoria');
    } else if (!this.esURLValida(datos.imagen)) {
      errores.push('La URL de la imagen no es válida');
    }

    // Validar precios
    if (!datos.precioOriginal || datos.precioOriginal <= 0) {
      errores.push('El precio original debe ser mayor a 0');
    }

    if (!datos.precioFinal || datos.precioFinal <= 0) {
      errores.push('El precio final debe ser mayor a 0');
    }

    if (datos.precioFinal && datos.precioOriginal && datos.precioFinal >= datos.precioOriginal) {
      errores.push('El precio final debe ser menor al precio original');
    }

    // Validar productos
    if (!datos.productos || datos.productos.length === 0) {
      errores.push('Debes seleccionar al menos un producto');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  },

  /**
   * Validar URL
   */
  esURLValida(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Calcular descuento porcentual
   */
  calcularDescuento(precioOriginal, precioFinal) {
    if (!precioOriginal || !precioFinal) return 0;
    return Math.round(((precioOriginal - precioFinal) / precioOriginal) * 100);
  },

  /**
   * Formatear fecha para mostrar
   */
  formatearFecha(fecha) {
    const opciones = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(fecha).toLocaleDateString('es-PE', opciones);
  },

  /**
   * Obtener días restantes hasta el evento
   */
  diasRestantes(fecha) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(fecha);
    fechaEvento.setHours(0, 0, 0, 0);
    
    const diferencia = fechaEvento - hoy;
    return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
  },

  /**
   * Generar emoji según el nombre del evento
   */
  obtenerEmoji(nombreEvento) {
    const nombre = nombreEvento.toLowerCase();
    
    if (nombre.includes('madre')) return '🌹';
    if (nombre.includes('padre')) return '👔';
    if (nombre.includes('amor') || nombre.includes('amistad') || nombre.includes('valentin')) return '💐';
    if (nombre.includes('navidad')) return '🎄';
    if (nombre.includes('año nuevo')) return '🎊';
    if (nombre.includes('halloween')) return '🎃';
    if (nombre.includes('pascua')) return '🐰';
    if (nombre.includes('cumpleaños')) return '🎂';
    if (nombre.includes('graduación')) return '🎓';
    if (nombre.includes('boda') || nombre.includes('matrimonio')) return '💒';
    
    return '🌸'; // Default
  },

  /**
   * Preparar datos para guardar
   */
  prepararDatos(formData) {
    return {
      fecha: formData.fecha,
      nombre: formData.nombre.trim(),
      imagen: formData.imagen.trim(),
      descripcion: formData.descripcion ? formData.descripcion.trim() : '',
      productos: formData.productos || [],
      precioOriginal: parseFloat(formData.precioOriginal),
      precioFinal: parseFloat(formData.precioFinal),
      emoji: this.obtenerEmoji(formData.nombre),
      activo: formData.activo !== undefined ? formData.activo : true
    };
  }
};

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Eventos;
}

/**
 * Estado global de la aplicación
 * Patrón Observer simple sin frameworks
 */

const Store = {
  _state: {
    user: null,
    cashbox: null,
    unreadAlerts: 0,
    isLoading: false,
  },
  _listeners: {},

  get(key) {
    return this._state[key];
  },

  set(key, value) {
    this._state[key] = value;
    this._emit(key, value);
    this._emit('*', this._state);
  },

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  },

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
  },

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  },

  getAll() {
    return { ...this._state };
  },
};

export default Store;

/**
 * Controlador de Autenticación
 */
import { AuthService } from '../services/api.js';
import Store from '../utils/store.js';
import { Toast } from '../components/ui.js';
import { Router } from '../utils/router.js';

export const AuthController = {
  async login(email, password) {
    const res = await AuthService.login(email, password);
    const { user, accessToken, refreshToken } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    Store.set('user', user);
    Toast.success(`Bienvenido, ${user.first_name}!`);
    Router.navigate('/dashboard');
  },

  async logout() {
    try { await AuthService.logout(); } catch {}
    localStorage.clear();
    Store.set('user', null);
    Store.set('cashbox', null);
    Router.navigate('/login');
  },

  async verifySession() {
    const token = localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');
    if (!token || !savedUser) return false;
    try {
      const res = await AuthService.verify();
      Store.set('user', res.data);
      return true;
    } catch (err) {
      // 429 = rate limit, no borrar sesión, asumir válida con datos guardados
      if (err.status === 429) {
        const user = JSON.parse(savedUser);
        Store.set('user', user);
        return true;
      }
      localStorage.clear();
      return false;
    }
  },

  getUser() {
    return Store.get('user');
  },
};

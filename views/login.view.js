/**
 * Vista de Login
 */
import { AuthController } from '../controllers/auth.controller.js';
import { Toast } from '../components/ui.js';

export function renderLogin() {
  const page = document.getElementById('login-page');
  const shell = document.getElementById('app-shell');
  page.classList.remove('hidden');
  shell.classList.add('hidden');

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const togglePwd = document.getElementById('toggle-pwd');
  const loginBtn = document.getElementById('login-btn');
  const loginBtnText = document.getElementById('login-btn-text');

  // Toggle password
  togglePwd.addEventListener('click', () => {
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
  });

  // Submit
  form.onsubmit = async (e) => {
    e.preventDefault();
    // Clear errors
    document.getElementById('err-email').textContent = '';
    document.getElementById('err-password').textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let valid = true;
    if (!email) {
      document.getElementById('err-email').textContent = 'El correo es requerido';
      valid = false;
    }
    if (!password) {
      document.getElementById('err-password').textContent = 'La contraseña es requerida';
      valid = false;
    }
    if (!valid) return;

    loginBtn.disabled = true;
    loginBtnText.textContent = 'Iniciando sesión...';

    try {
      await AuthController.login(email, password);
      window.location.reload();
    } catch (err) {
      if (err.status === 429) {
        Toast.error('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      } else {
        Toast.error(err.message || 'Error al iniciar sesión');
      }
      loginBtn.disabled = false;
      loginBtnText.textContent = 'Iniciar sesión';
    }
  };
}

/**
 * Constructor de formularios dinámicos
 */
import { escapeHtml } from '../utils/helpers.js';

/**
 * Genera HTML de formulario a partir de definición de campos
 * @param {Array} fields - configuración de campos
 * @param {Object} initialValues - valores iniciales
 * @param {Object} options - {submitLabel, cancelLabel, onCancel}
 */
export function buildForm(fields, initialValues = {}, options = {}) {
  const submitLabel = options.submitLabel || 'Guardar';
  const html = `
    <form id="dynamic-form" class="form-grid" novalidate>
      ${fields.map(field => renderField(field, initialValues[field.name])).join('')}
      <div class="form-actions">
        ${options.onCancel ? `<button type="button" id="form-cancel" class="btn btn-ghost">${escapeHtml(options.cancelLabel || 'Cancelar')}</button>` : ''}
        <button type="submit" class="btn btn-primary" id="form-submit">
          <span id="btn-text">${escapeHtml(submitLabel)}</span>
        </button>
      </div>
    </form>
  `;
  return html;
}

function renderField(field, value) {
  const { name, label, type = 'text', required, placeholder, options, hint, span } = field;
  const val = value !== undefined && value !== null ? value : (field.defaultValue ?? '');
  const spanClass = span ? `style="grid-column:span ${span}"` : '';

  let input;
  switch (type) {
    case 'select':
      input = `<select name="${name}" id="${name}" class="form-input" ${required ? 'required' : ''}>
        ${!required ? '<option value="">Seleccionar...</option>' : ''}
        ${(options || []).map(opt => {
          const optVal = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          return `<option value="${escapeHtml(String(optVal))}" ${String(val) === String(optVal) ? 'selected' : ''}>${escapeHtml(optLabel)}</option>`;
        }).join('')}
      </select>`;
      break;

    case 'textarea':
      input = `<textarea name="${name}" id="${name}" class="form-input" rows="3" 
        placeholder="${escapeHtml(placeholder || '')}" ${required ? 'required' : ''}>${escapeHtml(String(val))}</textarea>`;
      break;

    case 'checkbox':
      input = `<label class="checkbox-label">
        <input type="checkbox" name="${name}" id="${name}" ${val ? 'checked' : ''}>
        <span>${escapeHtml(label)}</span>
      </label>`;
      return `<div class="form-group" ${spanClass}>${input}${hint ? `<span class="form-hint">${escapeHtml(hint)}</span>` : ''}</div>`;

    case 'number':
      input = `<input type="number" name="${name}" id="${name}" class="form-input" 
        value="${escapeHtml(String(val))}" placeholder="${escapeHtml(placeholder || '')}" 
        step="${field.step || 'any'}" min="${field.min ?? ''}" max="${field.max ?? ''}" ${required ? 'required' : ''}>`;
      break;

    case 'password':
      input = `<div class="input-with-toggle">
        <input type="password" name="${name}" id="${name}" class="form-input" 
          value="${escapeHtml(String(val))}" placeholder="${escapeHtml(placeholder || '')}" ${required ? 'required' : ''}>
        <button type="button" class="toggle-password" data-target="${name}" tabindex="-1">👁</button>
      </div>`;
      break;

    default:
      input = `<input type="${type}" name="${name}" id="${name}" class="form-input" 
        value="${escapeHtml(String(val))}" placeholder="${escapeHtml(placeholder || '')}" ${required ? 'required' : ''}>`;
  }

  return `
    <div class="form-group" ${spanClass}>
      <label for="${name}" class="form-label">${escapeHtml(label)}${required ? '<span style="color:#ef4444">*</span>' : ''}</label>
      ${input}
      ${hint ? `<span class="form-hint">${escapeHtml(hint)}</span>` : ''}
      <span class="form-error" id="err-${name}"></span>
    </div>
  `;
}

/**
 * Adjunta handlers al formulario dinámico
 */
export function attachFormHandlers(formEl, onSubmit) {
  if (!formEl) return;

  // Toggle password visibility
  formEl.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = formEl.querySelector(`#${btn.dataset.target}`);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Form submit
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(formEl);

    const data = getFormData(formEl);
    const submitBtn = formEl.querySelector('#form-submit');
    const btnText = formEl.querySelector('#btn-text');

    submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Guardando...';

    try {
      await onSubmit(data);
    } catch (err) {
      handleFormError(formEl, err);
    } finally {
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = submitBtn.dataset.originalText || 'Guardar';
    }
  });
}

export function getFormData(formEl) {
  const data = {};
  const formData = new FormData(formEl);
  
  // DEBUG: Log form data types for phone field
  const phoneValue = formData.get('phone');
  console.log('[DEBUG getFormData] Phone input value:', phoneValue, 'Type:', typeof phoneValue);

  formEl.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'checkbox') {
      data[el.name] = el.checked;
    } else if (el.type === 'number') {
      const val = formData.get(el.name);
      data[el.name] = val !== '' ? Number(val) : null;
    } else {
      const val = formData.get(el.name);
      // FIX: Explicitly convert to String to ensure backend receives string type
      // This fixes validation errors like "phone must be a string"
      if (val !== null && val !== '') {
        data[el.name] = String(val);
      }
    }
  });

  return data;
}

export function clearErrors(formEl) {
  formEl.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; });
  formEl.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
}

export function setFieldError(formEl, fieldName, message) {
  const errEl = formEl.querySelector(`#err-${fieldName}`);
  const input = formEl.querySelector(`#${fieldName}`);
  if (errEl) errEl.textContent = message;
  if (input) input.classList.add('error');
}

function handleFormError(formEl, err) {
  // Intenta mapear errores de validación a campos
  if (err.data?.errors) {
    Object.entries(err.data.errors).forEach(([field, msg]) => {
      setFieldError(formEl, field, msg);
    });
  }
}

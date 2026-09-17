/**
 * KyriosStems - js/ui/toast.js
 * Notificações transitórias.
 */

import { el } from '../core/dom.js';

let region = null;

function ensureRegion() {
  if (region && document.body.contains(region)) return region;
  region = document.querySelector('.toast-region');
  if (!region) {
    region = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  return region;
}

/**
 * @param {string} message
 * @param {{type?: 'info'|'success'|'error', timeout?: number}} [options]
 */
export function toast(message, { type = 'info', timeout = 4200 } = {}) {
  const node = el('div', { class: `toast toast--${type}`, role: 'status' }, message);
  ensureRegion().append(node);

  window.setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    window.setTimeout(() => node.remove(), 220);
  }, timeout);

  return node;
}

export const notifySuccess = (message) => toast(message, { type: 'success' });
export const notifyError = (message) => toast(message, { type: 'error', timeout: 6000 });
export const notifyInfo = (message) => toast(message, { type: 'info' });
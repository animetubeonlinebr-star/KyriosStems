/**
 * KyriosStems - js/ui/modal.js
 * Diálogos de confirmação e formulários em modal.
 */

import { el } from '../core/dom.js';
import { icon } from './icons.js';

/**
 * Abre um modal genérico.
 * @param {{title: string, content: Node, footer?: Node[], onClose?: () => void}} options
 * @returns {{close: () => void, panel: HTMLElement}}
 */
export function openModal({ title, content, footer = [], onClose }) {
  const previouslyFocused = document.activeElement;

  const closeButton = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn',
      'aria-label': 'Fechar',
      onClick: () => close(),
    },
    [icon('close', { size: 16 })],
  );

  const panel = el('div', { class: 'modal__panel', role: 'dialog', 'aria-modal': 'true' }, [
    el('div', { class: 'modal__header' }, [
      el('h2', { class: 'modal__title', text: title }),
      closeButton,
    ]),
    el('div', { class: 'modal__body' }, [content]),
    footer.length ? el('div', { class: 'modal__footer' }, footer) : null,
  ]);

  const overlay = el(
    'div',
    {
      class: 'modal',
      onClick: (event) => {
        if (event.target === overlay) close();
      },
    },
    [panel],
  );

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    onClose?.();
  }

  document.addEventListener('keydown', onKeydown);
  document.body.append(overlay);
  panel.querySelector('button')?.focus();

  return { close, panel };
}

/**
 * Confirmação com ação destrutiva.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = 'Confirmar',
  message = 'Tem certeza?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;

    const cancelButton = el('button', {
      type: 'button',
      class: 'btn btn--secondary',
      text: cancelLabel,
      onClick: () => finish(false),
    });

    const confirmButton = el('button', {
      type: 'button',
      class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
      text: confirmLabel,
      onClick: () => finish(true),
    });

    const modal = openModal({
      title,
      content: el('p', { class: 'text-muted', text: message }),
      footer: [cancelButton, confirmButton],
      onClose: () => finish(false),
    });

    function finish(value) {
      if (settled) return;
      settled = true;
      resolve(value);
      modal.close();
    }

    confirmButton.focus();
  });
}
/**
 * KyriosStems - js/core/dom.js
 * Ajudantes mínimos de manipulação de DOM.
 */

/** @param {string} selector @param {ParentNode} [scope] */
export function $(selector, scope = document) {
  return scope.querySelector(selector);
}

/** @param {string} selector @param {ParentNode} [scope] */
export function $$(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/**
 * Cria um elemento.
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {Array<Node|string>} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') {
      node.className = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

/** @param {Element} node */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Substitui o conteúdo de um nó por um ou vários filhos. */
export function mount(node, child) {
  clear(node);
  for (const item of [].concat(child)) {
    if (item === null || item === undefined || item === false) continue;
    node.append(item instanceof Node ? item : document.createTextNode(String(item)));
  }
  return node;
}

export function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = Boolean(hidden);
}

export function setText(node, value) {
  if (node) node.textContent = value ?? '';
}

export function toggleClass(node, className, on) {
  if (node) node.classList.toggle(className, Boolean(on));
}

/** Executa o callback quando o DOM estiver pronto. */
export function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

/** Anuncia uma mensagem em uma região aria-live. */
export function announce(node, message) {
  if (!node) return;
  node.textContent = '';
  window.setTimeout(() => {
    node.textContent = message;
  }, 60);
}

/** Extrai os parâmetros da query string da URL atual. */
export function queryParams(search = window.location.search) {
  return new URLSearchParams(search);
}

/** Preenche um <select> com opções. */
export function fillSelect(select, options, { placeholder = null } = {}) {
  if (!select) return select;
  const current = select.value;

  const items = [];
  if (placeholder !== null) {
    items.push(el('option', { value: '', text: placeholder }));
  }
  for (const option of options) {
    const value = typeof option === 'object' ? option.value : option;
    const label = typeof option === 'object' ? option.label : option;
    items.push(el('option', { value, text: label }));
  }

  mount(select, items);
  if (current) select.value = current;
  return select;
}
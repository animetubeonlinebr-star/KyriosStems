/**
 * KyriosStems - js/components/search.js
 * Campo de busca com botão de limpar.
 */

import { el } from '../core/dom.js';
import { debounce } from '../core/format.js';
import { icon } from '../ui/icons.js';

/**
 * @param {{placeholder?: string, value?: string, onInput: (value: string) => void, delay?: number}} options
 */
export function createSearch({ placeholder = 'Pesquisar música...', value = '', onInput, delay = 200 }) {
  const input = el('input', {
    type: 'search',
    class: 'search__input',
    placeholder,
    value,
    'aria-label': 'Pesquisar música',
    autocomplete: 'off',
  });

  const clearButton = el('button', {
    type: 'button',
    class: 'search__clear',
    'aria-label': 'Limpar busca',
    onClick: () => {
      input.value = '';
      wrapper.classList.remove('has-value');
      onInput('');
      input.focus();
    },
  }, [icon('close', { size: 14 })]);

  const emit = debounce(onInput, delay);

  input.addEventListener('input', () => {
    wrapper.classList.toggle('has-value', input.value.length > 0);
    emit(input.value);
  });

  const wrapper = el('div', { class: `search${value ? ' has-value' : ''}` }, [
    icon('search', { size: 16, class: 'search__icon' }),
    input,
    clearButton,
  ]);

  return {
    element: wrapper,
    getValue: () => input.value,
    setValue: (next) => {
      input.value = next;
      wrapper.classList.toggle('has-value', Boolean(next));
    },
    focus: () => input.focus(),
  };
}
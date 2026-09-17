/**
 * KyriosStems - js/components/filters.js
 * Filtros combinados do catálogo: artista, tom, categoria e DAW.
 *
 * Recebe os valores derivados da biblioteca carregada, garantindo que só
 * apareçam opções que realmente existem.
 */

import { el, fillSelect } from '../core/dom.js';
import { icon } from '../ui/icons.js';

/**
 * @typedef {Object} CatalogFilters
 * @property {string} artist
 * @property {string} key
 * @property {string} category
 * @property {string} daw
 * @property {string} bpmRange
 */

/** Faixas de BPM oferecidas no filtro. */
export const BPM_RANGES = [
  { value: '0-75', label: 'Até 75 BPM', min: 0, max: 75 },
  { value: '76-100', label: '76 – 100 BPM', min: 76, max: 100 },
  { value: '101-130', label: '101 – 130 BPM', min: 101, max: 130 },
  { value: '131-999', label: 'Acima de 130 BPM', min: 131, max: Number.POSITIVE_INFINITY },
];

/** @returns {CatalogFilters} */
export function emptyFilters() {
  return { artist: '', key: '', category: '', daw: '', bpmRange: '' };
}

/** Indica se algum filtro está ativo. */
export function hasActiveFilters(filters) {
  return Object.values(filters).some((value) => value !== '');
}

/**
 * @param {{options: {artists: string[], keys: string[], categories: string[], daws: string[]}, value: CatalogFilters, onChange: (filters: CatalogFilters) => void}} params
 */
export function createFilters({ options, value, onChange }) {
  const state = { ...emptyFilters(), ...value };

  const artistSelect = el('select', { class: 'select', 'aria-label': 'Filtrar por intérprete' });
  const keySelect = el('select', { class: 'select', 'aria-label': 'Filtrar por tom' });
  const bpmSelect = el('select', { class: 'select', 'aria-label': 'Filtrar por BPM' });
  const categorySelect = el('select', { class: 'select', 'aria-label': 'Filtrar por categoria' });
  const dawSelect = el('select', { class: 'select', 'aria-label': 'Filtrar por DAW' });

  fillSelect(artistSelect, options.artists, { placeholder: 'Todos os intérpretes' });
  fillSelect(keySelect, options.keys, { placeholder: 'Todos os tons' });
  fillSelect(bpmSelect, BPM_RANGES.map(({ value: v, label }) => ({ value: v, label })), {
    placeholder: 'Todos os BPM',
  });
  fillSelect(categorySelect, options.categories, { placeholder: 'Todas as categorias' });
  fillSelect(dawSelect, options.daws, { placeholder: 'Todas as DAWs' });

  artistSelect.value = state.artist;
  keySelect.value = state.key;
  bpmSelect.value = state.bpmRange;
  categorySelect.value = state.category;
  dawSelect.value = state.daw;

  const bind = (select, field) => {
    select.addEventListener('change', () => {
      state[field] = select.value;
      onChange({ ...state });
    });
  };

  bind(artistSelect, 'artist');
  bind(keySelect, 'key');
  bind(bpmSelect, 'bpmRange');
  bind(categorySelect, 'category');
  bind(dawSelect, 'daw');

  const resetButton = el('button', {
    type: 'button',
    class: 'btn btn--ghost btn--sm',
    onClick: () => {
      Object.assign(state, emptyFilters());
      for (const select of [artistSelect, keySelect, bpmSelect, categorySelect, dawSelect]) {
        select.value = '';
      }
      onChange({ ...state });
    },
  }, [icon('refresh', { size: 14 }), 'Limpar filtros']);

  const element = el('div', { class: 'filters' }, [
    field('Intérprete', artistSelect),
    field('Tom', keySelect),
    field('BPM', bpmSelect),
    field('Categoria', categorySelect),
    field('DAW', dawSelect),
    el('div', { class: 'filters__actions' }, [resetButton]),
  ]);

  return {
    element,
    getValue: () => ({ ...state }),
    setValue: (next) => {
      Object.assign(state, emptyFilters(), next);
      artistSelect.value = state.artist;
      keySelect.value = state.key;
      bpmSelect.value = state.bpmRange;
      categorySelect.value = state.category;
      dawSelect.value = state.daw;
    },
  };
}

function field(label, control) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', text: label, for: control.id || undefined }),
    control,
  ]);
}

/**
 * Aplica os filtros a uma lista de músicas.
 * @param {import('../models/song.js').Song[]} songs
 * @param {import('../models/daw-session.js').DawSession[]} sessions
 * @param {CatalogFilters} filters
 */
export function applyFilters(songs, sessions, filters) {
  const sessionsBySong = new Map();
  for (const session of sessions) {
    if (!sessionsBySong.has(session.songId)) sessionsBySong.set(session.songId, []);
    sessionsBySong.get(session.songId).push(session);
  }

  const range = BPM_RANGES.find((item) => item.value === filters.bpmRange);

  return songs
    .map((song) => ({ song, sessions: sessionsBySong.get(song.id) ?? [] }))
    .filter(({ song, sessions: list }) => {
      if (filters.artist && song.artist !== filters.artist) return false;
      if (filters.key && song.key !== filters.key) return false;
      if (filters.category && song.category !== filters.category) return false;
      if (filters.daw && !list.some((session) => session.daw === filters.daw)) return false;
      if (range) {
        const bpm = Number(song.bpm);
        if (!Number.isFinite(bpm) || bpm < range.min || bpm > range.max) return false;
      }
      return true;
    });
}
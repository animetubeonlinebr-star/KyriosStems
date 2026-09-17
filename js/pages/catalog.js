/**
 * KyriosStems - js/pages/catalog.js
 * Catálogo: lista, busca, filtros combinados e atalho para a página da música.
 */

import { $, clear, el, mount, ready, setText } from '../core/dom.js';
import { ROUTES } from '../core/constants.js';
import { compareText, formatBytes, groupBy } from '../core/format.js';
import { searchIndex } from '../models/song.js';
import { loadLibrary } from '../services/library-service.js';
import { createSearch } from '../components/search.js';
import { createFilters, applyFilters, emptyFilters, hasActiveFilters } from '../components/filters.js';
import { songCard } from '../components/song-card.js';
import { mountChrome } from '../components/app-header.js';
import { icon } from '../ui/icons.js';
import { notifyError } from '../ui/toast.js';

const state = {
  library: null,
  filters: emptyFilters(),
  term: '',
  view: 'grid',
};

ready(init);

async function init() {
  mountChrome({ active: 'catalog' });
  buildHero();
  renderLoading();

  try {
    state.library = await loadLibrary();
  } catch (error) {
    renderError(error);
    return;
  }

  buildToolbar();
  renderResults();
  renderHeroStats();
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

function buildHero() {
  const mountPoint = $('[data-hero]');
  if (!mountPoint) return;

  const wave = el(
    'div',
    { class: 'catalog-hero__wave', 'aria-hidden': 'true' },
    Array.from({ length: 42 }, (_, index) =>
      el('span', { style: `height:${waveHeight(index)}%` }),
    ),
  );

  mountPoint.append(
    el('div', { class: 'catalog-hero__inner' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Personal Worship Multitrack Library' }),
        el('h1', { class: 'catalog-hero__title' }, [
          'Kyrios',
          el('span', { class: 'catalog-hero__title-accent', text: 'Stems' }),
        ]),
        el('p', { class: 'catalog-hero__tagline', text: 'Sessões prontas para DAW' }),
        el('p', {
          class: 'catalog-hero__description',
          text: 'Biblioteca pessoal de músicas de louvor em formato multitrack. Cada música reúne uma ou mais sessões preparadas para diferentes DAWs, prontas para baixar e abrir diretamente no seu projeto.',
        }),
        wave,
      ]),
      el('div', { class: 'catalog-hero__stats', 'data-hero-stats': true }, [
        heroStat('songs', 'Músicas'),
        heroStat('sessions', 'Sessões'),
        heroStat('daws', 'DAWs'),
      ]),
    ]),
  );
}

function heroStat(key, label) {
  return el('div', { class: 'catalog-hero__stat' }, [
    el('span', { class: 'catalog-hero__stat-value', 'data-stat': key, text: '—' }),
    el('span', { class: 'catalog-hero__stat-label', text: label }),
  ]);
}

function renderHeroStats() {
  const facts = state.library.facets;
  setText($('[data-stat="songs"]'), String(state.library.songs.length).padStart(2, '0'));
  setText($('[data-stat="sessions"]'), String(facts.sessionCount).padStart(2, '0'));
  setText($('[data-stat="daws"]'), String(facts.daws.length).padStart(2, '0'));
}

function waveHeight(index) {
  const value = Math.abs(Math.sin(index * 1.7) * 0.6 + Math.cos(index * 0.9) * 0.4);
  return Math.round(18 + value * 82);
}

/* -------------------------------------------------------------------------- */
/* Barra de ferramentas                                                       */
/* -------------------------------------------------------------------------- */

function buildToolbar() {
  const toolbar = $('[data-toolbar]');
  if (!toolbar) return;

  const search = createSearch({
    placeholder: 'Pesquisar por música, intérprete, tag...',
    onInput: (value) => {
      state.term = value;
      renderResults();
    },
  });

  const filters = createFilters({
    options: {
      artists: state.library.facets.artists,
      keys: state.library.facets.keys,
      categories: state.library.facets.categories,
      daws: state.library.facets.daws,
    },
    value: state.filters,
    onChange: (value) => {
      state.filters = value;
      renderResults();
    },
  });

  const viewSwitch = el('div', { class: 'view-switch', role: 'group', 'aria-label': 'Modo de exibição' }, [
    viewButton('grid', 'Grade', 'grid'),
    viewButton('artist', 'Por intérprete', 'list'),
  ]);

  toolbar.append(el('div', { class: 'catalog-toolbar' }, [search.element, viewSwitch, spacer()]));
  toolbar.append(filters.element);

  function viewButton(view, label, iconName) {
    const button = el('button', {
      type: 'button',
      class: 'view-switch__btn',
      'aria-pressed': String(state.view === view),
      onClick: () => {
        state.view = view;
        for (const node of viewSwitch.querySelectorAll('.view-switch__btn')) {
          node.setAttribute('aria-pressed', String(node === button));
        }
        renderResults();
      },
    }, [icon(iconName, { size: 12 }), label]);
    return button;
  }
}

/** Espaçador para manter o grid do toolbar alinhado. */
function spacer() {
  return el('span', { class: 'catalog-toolbar__spacer' });
}

/* -------------------------------------------------------------------------- */
/* Resultados                                                                 */
/* -------------------------------------------------------------------------- */

function renderResults() {
  const results = $('[data-results]');
  if (!results) return;

  const searched = filterByTerm(state.library.songs, state.term);
  const filtered = applyFilters(searched, state.library.sessions, state.filters);

  renderResultsBar(filtered.length, searched.length);

  if (!filtered.length) {
    mount(results, emptyState());
    return;
  }

  if (state.view === 'artist') {
    renderByArtist(results, filtered);
  } else {
    renderGrid(results, filtered);
  }
}

function renderGrid(container, entries) {
  clear(container).append(
    el(
      'div',
      { class: 'song-grid' },
      entries.map(({ song, sessions }) => songCard(song, { sessions })),
    ),
  );
}

function renderByArtist(container, entries) {
  const groups = groupBy(entries, (entry) => entry.song.artist || 'Sem intérprete');
  const sorted = [...groups.entries()].sort((a, b) => compareText(a[0], b[0]));

  clear(container);
  for (const [artist, list] of sorted) {
    container.append(
      el('section', { class: 'artist-group' }, [
        el('div', { class: 'artist-group__title' }, [
          el('h2', { text: artist }),
          el('span', { class: 'badge mono', text: `${list.length} música(s)` }),
        ]),
        el(
          'div',
          { class: 'song-grid' },
          list.map(({ song, sessions }) => songCard(song, { sessions })),
        ),
      ]),
    );
  }
}

function renderResultsBar(shown, searchedTotal) {
  const bar = $('[data-results-bar]');
  if (!bar) return;

  const total = state.library.songs.length;
  const parts = [`${shown} de ${total} música(s)`];

  if (hasActiveFilters(state.filters)) parts.push('filtros ativos');
  if (state.term) parts.push(`busca: “${state.term}”`);

  mount(bar, [
    el('span', { text: parts.join(' • ') }),
    el('span', {
      class: 'mono',
      text: searchedTotal === total ? '' : `${searchedTotal} correspondência(s)`,
    }),
  ]);
}

function filterByTerm(songs, term) {
  const needle = String(term ?? '').trim();
  if (!needle) return songs;
  const normalized = searchIndex({ title: needle });
  return songs.filter((song) => searchIndex(song).includes(normalized));
}

function emptyState() {
  const nothing = state.library.songs.length === 0;
  return el('div', { class: 'empty-state' }, [
    icon('music', { size: 32, class: 'text-faint' }),
    el('h2', { class: 'empty-state__title', text: nothing ? 'Biblioteca vazia' : 'Nenhum resultado' }),
    el('p', {
      class: 'empty-state__text',
      text: nothing
        ? 'Ainda não há músicas cadastradas. Entre no painel administrativo para cadastrar a primeira sessão.'
        : 'Nenhuma música corresponde à busca e aos filtros aplicados. Ajuste os critérios ou limpe os filtros.',
    }),
    nothing
      ? el('a', { class: 'btn btn--secondary', href: ROUTES.login }, ['Acessar o painel'])
      : el('button', {
          type: 'button',
          class: 'btn btn--secondary',
          onClick: () => {
            state.term = '';
            state.filters = emptyFilters();
            window.location.reload();
          },
        }, ['Limpar busca e filtros']),
  ]);
}

function renderLoading() {
  const results = $('[data-results]');
  if (!results) return;
  mount(results, el('div', { class: 'loading-state' }, [
    el('div', { class: 'spinner' }),
    el('span', { text: 'Carregando biblioteca...' }),
  ]));
}

function renderError(error) {
  const results = $('[data-results]');
  if (!results) return;
  mount(results, el('div', { class: 'empty-state' }, [
    icon('alert', { size: 32, class: 'text-faint' }),
    el('h2', { class: 'empty-state__title', text: 'Não foi possível carregar a biblioteca' }),
    el('p', { class: 'empty-state__text', text: error instanceof Error ? error.message : String(error) }),
  ]));
  notifyError('Falha ao carregar a biblioteca.');
}

/** Formata o total de bytes da biblioteca. */
export function librarySizeLabel(bytes) {
  return formatBytes(bytes);
}
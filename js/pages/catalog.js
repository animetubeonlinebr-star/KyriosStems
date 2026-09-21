/**
 * KyriosStems - js/pages/catalog.js
 * Catálogo: lista, busca, filtros combinados e atalho para a página da música.
 */

import { $, clear, el, mount, ready, setText } from '../core/dom.js';
import { ROUTES } from '../core/constants.js';
import { compareText, groupBy } from '../core/format.js';
import { loadLibrary, searchSongs } from '../services/library-service.js';
import { createSearch } from '../components/search.js';
import {
  createFilters,
  applyFilters,
  emptyFilters,
  hasActiveFilters,
} from '../components/filters.js';
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

  state.library = await loadLibrary();

  buildToolbar();
  renderNotices();
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
    Array.from({ length: 42 }, (_, index) => el('span', { style: `height:${waveHeight(index)}%` })),
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
      el('div', { class: 'catalog-hero__stats' }, [
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
  const { facets, songs } = state.library;
  setText($('[data-stat="songs"]'), String(songs.length).padStart(2, '0'));
  setText($('[data-stat="sessions"]'), String(facets.sessionCount).padStart(2, '0'));
  setText($('[data-stat="daws"]'), String(facets.daws.length).padStart(2, '0'));
}

function waveHeight(index) {
  const value = Math.abs(Math.sin(index * 1.7) * 0.6 + Math.cos(index * 0.9) * 0.4);
  return Math.round(18 + value * 82);
}

/* -------------------------------------------------------------------------- */
/* Avisos                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Avisa quando os dados exibidos não vêm da API.
 *
 * O repositório degrada para a biblioteca de demonstração quando a leitura
 * falha. Sem este aviso o usuário acreditaria estar vendo a biblioteca real.
 */
function renderNotices() {
  const mountPoint = $('[data-notices]');
  if (!mountPoint) return;

  const { isDemo, error } = state.library;
  clear(mountPoint);

  if (!isDemo) return;

  if (error) {
    mountPoint.append(
      el('div', { class: 'alert alert--error', role: 'alert' }, [
        icon('alert', { size: 16 }),
        el('div', {}, [
          el('strong', { text: 'Não foi possível ler a biblioteca. ' }),
          el('span', { text: error }),
          el('p', { class: 'field__hint mt-4' }, [
            'Exibindo dados de demonstração até que a leitura volte a funcionar.',
          ]),
        ]),
      ]),
    );
    notifyError('Falha ao ler a biblioteca. Exibindo dados de demonstração.');
    return;
  }

  mountPoint.append(
    el('div', { class: 'setup-note' }, [
      el('strong', { text: 'Modo demonstração. ' }),
      el('span', {
        text: 'A API não respondeu, então o catálogo abaixo usa uma biblioteca de exemplo. ',
      }),
      el('span', { text: 'Confira o endereço em ' }),
      el('code', { text: 'js/core/config.js' }),
      el('span', { text: ' e se o backend está no ar.' }),
    ]),
  );
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

  const viewSwitch = el(
    'div',
    { class: 'view-switch', role: 'group', 'aria-label': 'Modo de exibição' },
    [viewButton('grid', 'Grade', 'grid'), viewButton('artist', 'Por intérprete', 'list')],
  );

  toolbar.append(
    el('div', { class: 'catalog-toolbar' }, [search.element, viewSwitch, el('span')]),
  );
  toolbar.append(filters.element);

  function viewButton(view, label, iconName) {
    const button = el(
      'button',
      {
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
      },
      [icon(iconName, { size: 12 }), label],
    );
    return button;
  }
}

/* -------------------------------------------------------------------------- */
/* Resultados                                                                 */
/* -------------------------------------------------------------------------- */

function renderResults() {
  const results = $('[data-results]');
  if (!results) return;

  const searched = searchSongs(state.library.songs, state.term);
  const filtered = applyFilters(searched, state.library.sessions, state.filters);

  renderResultsBar(filtered.length, searched.length);

  if (!filtered.length) {
    mount(results, emptyState());
    return;
  }

  if (state.view === 'artist') {
    renderByArtist(results, filtered);
  } else {
    clear(results).append(
      el(
        'div',
        { class: 'song-grid' },
        filtered.map(({ song, sessions }) => songCard(song, { sessions })),
      ),
    );
  }
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

function renderResultsBar(shown, afterSearch) {
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
      text: afterSearch === total ? '' : `${afterSearch} correspondência(s)`,
    }),
  ]);
}

function emptyState() {
  const empty = state.library.songs.length === 0;

  if (empty) {
    return el('div', { class: 'empty-state' }, [
      icon('music', { size: 32, class: 'text-faint' }),
      el('h2', { class: 'empty-state__title', text: 'Biblioteca vazia' }),
      el('p', {
        class: 'empty-state__text',
        text: 'Ainda não há músicas cadastradas. Entre no painel administrativo para cadastrar a primeira sessão.',
      }),
      el('a', { class: 'btn btn--secondary', href: ROUTES.login }, ['Acessar o painel']),
    ]);
  }

  return el('div', { class: 'empty-state' }, [
    icon('search', { size: 32, class: 'text-faint' }),
    el('h2', { class: 'empty-state__title', text: 'Nenhum resultado' }),
    el('p', {
      class: 'empty-state__text',
      text: 'Nenhuma música corresponde à busca e aos filtros aplicados. Ajuste os critérios ou limpe os filtros.',
    }),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary',
        onClick: () => {
          state.term = '';
          state.filters = emptyFilters();
          window.location.reload();
        },
      },
      ['Limpar busca e filtros'],
    ),
  ]);
}

function renderLoading() {
  const results = $('[data-results]');
  if (!results) return;
  mount(
    results,
    el('div', { class: 'loading-state' }, [
      el('div', { class: 'spinner' }),
      el('span', { text: 'Carregando biblioteca...' }),
    ]),
  );
}
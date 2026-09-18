/**
 * KyriosStems - js/pages/song.js
 * Página da música: informações musicais, sessões por DAW e download do pacote.
 */

import { $, clear, el, mount, ready, setText, queryParams } from '../core/dom.js';
import { QUERY, ROUTES, FILE_CATEGORY_LABELS } from '../core/constants.js';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDuration,
} from '../core/format.js';
import { loadSongDetail } from '../services/library-service.js';
import {
  preparePackageDownload,
  prepareFileDownload,
  startDownload,
  largePackageWarning,
} from '../services/download-service.js';
import { groupFiles, versionLabel } from '../models/daw-session.js';
import { sessionCard } from '../components/session-card.js';
import { mountChrome } from '../components/app-header.js';
import { icon } from '../ui/icons.js';
import { confirmDialog } from '../ui/modal.js';
import { notifyError, notifyInfo, notifySuccess } from '../ui/toast.js';

const state = {
  song: null,
  sessions: [],
  byDaw: new Map(),
  filesSessionId: null,
};

ready(init);

async function init() {
  const songId = queryParams().get(QUERY.songId);

  mountChrome({ active: 'song' });
  renderLoading();

  if (!songId) {
    renderNotFound('Nenhuma música foi informada na URL.');
    return;
  }

  const detail = await loadSongDetail(songId);
  state.song = detail.song;
  state.sessions = detail.sessions;
  state.byDaw = detail.byDaw;

  if (!detail.song) {
    renderNotFound('A música solicitada não existe na biblioteca.');
    return;
  }

  document.title = `${detail.song.title} — KyriosStems`;
  renderNotices(detail);
  render();
}

/* -------------------------------------------------------------------------- */
/* Avisos                                                                     */
/* -------------------------------------------------------------------------- */

/** Avisa quando a leitura da API falhou e os dados não são reais. */
function renderNotices(detail) {
  const mountPoint = $('[data-notices]');
  if (!mountPoint || !detail.isDemo) return;

  clear(mountPoint).append(
    el('div', { class: 'alert alert--error', role: 'alert' }, [
      icon('alert', { size: 16 }),
      el('div', {}, [
        el('strong', { text: 'Dados de demonstração. ' }),
        el('span', {
          text: detail.error || 'A API não respondeu.',
        }),
        el('p', { class: 'field__hint mt-4', text: 'Os downloads estão indisponíveis.' }),
      ]),
    ]),
  );
}

/* -------------------------------------------------------------------------- */
/* Render                                                                     */
/* -------------------------------------------------------------------------- */

function render() {
  renderHeader();
  renderPrimaryDownload();
  renderSessions();
}

function renderHeader() {
  const mountPoint = $('[data-song-header]');
  if (!mountPoint) return;

  const song = state.song;

  mount(mountPoint, [
    el('nav', { class: 'song-header__breadcrumb', 'aria-label': 'Trilha de navegação' }, [
      el('a', { href: ROUTES.catalog, text: 'Catálogo' }),
      el('span', { text: '/' }),
      el('span', { text: song.title }),
    ]),
    el('div', { class: 'song-header__grid' }, [
      el('div', {}, [
        el('h1', { class: 'song-header__title', text: song.title }),
        el('p', { class: 'song-header__artist', text: song.artist || 'Intérprete não informado' }),
        song.album ? el('p', { class: 'song-header__album mono', text: song.album }) : null,
        song.tags?.length
          ? el('ul', { class: 'chip-list song-header__tags' }, [
              song.category
                ? el('li', { class: 'badge badge--accent', text: song.category })
                : null,
              ...song.tags.map((tag) => el('li', { class: 'badge', text: tag })),
            ])
          : null,
      ]),
      el('div', { class: 'song-specs' }, [
        specItem('Tom', song.key || '—', true),
        specItem('BPM', song.bpm ? String(song.bpm) : '—'),
        specItem('Compasso', song.timeSignature || '—'),
        specItem('Duração', formatDuration(song.duration)),
      ]),
    ]),
    song.description ? el('p', { class: 'song-description', text: song.description }) : null,
  ]);
}

function specItem(label, value, accent = false) {
  return el('div', { class: 'song-specs__item' }, [
    el('span', { class: 'song-specs__label', text: label }),
    el('span', {
      class: `song-specs__value${accent ? ' song-specs__value--accent' : ''}`,
      text: value,
    }),
  ]);
}

/** Download principal: a sessão atual atualizada mais recentemente. */
function renderPrimaryDownload() {
  const mountPoint = $('[data-primary-download]');
  if (!mountPoint) return;

  const current = pickPrimarySession();
  if (!current) return;

  const warning = largePackageWarning(current.packageSize);
  const hasPackage = Boolean(current.packageFileId);

  mount(mountPoint, el('div', { class: 'primary-download' }, [
    el('div', {}, [
      el('span', { class: 'primary-download__label', text: 'Download principal' }),
      el('h2', {
        class: 'primary-download__title',
        text: `${state.song.title} — ${current.daw}`,
      }),
      el('p', { class: 'primary-download__meta' }, [
        `${versionLabel(current)} • ${formatDate(current.updatedAt || current.createdAt)} • ${formatBytes(current.packageSize)}`,
      ]),
      warning ? el('p', { class: 'field__hint', text: warning }) : null,
    ]),
    el('button', {
      type: 'button',
      class: 'btn btn--primary',
      disabled: !hasPackage,
      onClick: () => handlePackageDownload(current),
    }, [icon('download', { size: 16 }), 'Baixar sessão completa']),
  ]));
}

function renderSessions() {
  const mountPoint = $('[data-sessions]');
  if (!mountPoint) return;

  if (!state.sessions.length) {
    mount(mountPoint, el('p', {
      class: 'session-empty',
      text: 'Nenhuma sessão cadastrada para esta música.',
    }));
    return;
  }

  clear(mountPoint);
  for (const [daw, sessions] of state.byDaw) {
    const current = sessions.find((session) => session.isCurrent);

    mountPoint.append(el('section', { class: 'daw-block' }, [
      el('div', { class: 'daw-block__header' }, [
        el('h2', { class: 'daw-block__name', text: daw }),
        el('span', { class: 'badge mono', text: `${sessions.length} versão(ões)` }),
      ]),
      current
        ? sessionCard(current, {
            isCurrent: true,
            onDownload: handlePackageDownload,
            onToggleFiles: toggleFiles,
          })
        : null,
      sessions.length > 1
        ? el('div', { class: 'daw-block__versions' }, [
            el('p', { class: 'section-title', text: 'Histórico de versões' }),
            ...sessions
              .filter((session) => session.id !== current?.id)
              .map(versionRow),
          ])
        : null,
      el('div', { class: 'files-panel', 'data-files': daw }),
    ]));
  }
}

function versionRow(session) {
  return el('div', { class: 'version-row' }, [
    el('span', { class: 'version-row__version', text: versionLabel(session) }),
    el('span', { class: 'version-row__date', text: formatDateTime(session.updatedAt || session.createdAt) }),
    el('span', { class: 'version-row__meta' }, [
      el('span', { class: 'badge', text: session.format || '—' }),
      el('span', { class: 'badge', text: session.bitDepth ? `${session.bitDepth} bit` : '—' }),
      el('span', { class: 'badge', text: session.sampleRate ? `${session.sampleRate} Hz` : '—' }),
    ]),
    el('span', { class: 'version-row__actions' }, [
      el('button', {
        type: 'button',
        class: 'btn btn--secondary btn--sm',
        disabled: !session.packageFileId,
        onClick: () => handlePackageDownload(session),
      }, [icon('download', { size: 12 }), 'Baixar']),
    ]),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Arquivos individuais                                                       */
/* -------------------------------------------------------------------------- */

function toggleFiles(session) {
  const panel = document.querySelector(`[data-files="${cssEscape(session.daw)}"]`);
  if (!panel) return;

  if (state.filesSessionId === session.id) {
    state.filesSessionId = null;
    clear(panel);
    return;
  }

  state.filesSessionId = session.id;
  mount(panel, filesPanel(session));
}

function filesPanel(session) {
  const files = session.files ?? [];

  if (!files.length) {
    return el('p', { class: 'field__hint', text: 'Os arquivos individuais desta sessão não foram catalogados. Use o pacote completo.' });
  }

  const groups = groupFiles(files);

  return el('div', { class: 'file-tree' }, [
    el('h3', { class: 'section-title files-panel__title', text: 'Arquivos da sessão' }),
    ...[...groups.entries()].map(([category, list]) => fileGroup(category, list, session)),
  ]);
}

/** Grupo recolhível de arquivos de uma categoria. */
function fileGroup(category, files, session) {
  const label = FILE_CATEGORY_LABELS[category] || category;

  return el('div', { class: 'file-group', dataset: { collapsed: 'false' } }, [
    el(
      'button',
      {
        type: 'button',
        class: 'file-group__header',
        onClick: (event) => {
          const group = event.currentTarget.closest('.file-group');
          group.dataset.collapsed = group.dataset.collapsed === 'true' ? 'false' : 'true';
        },
      },
      [
        icon('chevron', { size: 14, class: 'file-group__chevron' }),
        label,
        el('span', { class: 'file-group__count mono', text: `${files.length}` }),
      ],
    ),
    el('div', { class: 'file-group__body' }, files.map((file) => fileRow(file, session))),
  ]);
}

function fileRow(file, session) {
  return el('div', { class: 'file-row' }, [
    icon('file', { size: 14, class: 'file-row__icon' }),
    el('span', { class: 'file-row__name', title: file.path || file.name, text: file.name }),
    el('span', { class: 'file-row__size', text: formatBytes(file.size) }),
    el('button', {
      type: 'button',
      class: 'file-row__action',
      'aria-label': `Baixar ${file.name}`,
      title: 'Baixar arquivo',
      onClick: () => handleFileDownload(session, file),
    }, [icon('download', { size: 14 })]),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Ações                                                                      */
/* -------------------------------------------------------------------------- */

async function handlePackageDownload(session) {
  const warning = largePackageWarning(session.packageSize);
  if (warning) {
    const confirmed = await confirmDialog({
      title: 'Pacote grande',
      message: `${warning} Deseja continuar?`,
      confirmLabel: 'Baixar mesmo assim',
    });
    if (!confirmed) return;
  }

  try {
    notifyInfo('Preparando o download...');
    const target = await preparePackageDownload(state.song, session);
    startDownload(target);
    notifySuccess(`Download iniciado: ${target.fileName}`);
  } catch (error) {
    notifyError(error instanceof Error ? error.message : String(error));
  }
}

async function handleFileDownload(session, file) {
  try {
    const target = await prepareFileDownload(session, file);
    startDownload(target);
    notifySuccess(`Download iniciado: ${target.fileName}`);
  } catch (error) {
    notifyError(error instanceof Error ? error.message : String(error));
  }
}

/* -------------------------------------------------------------------------- */
/* Estados                                                                    */
/* -------------------------------------------------------------------------- */

function renderLoading() {
  const mountPoint = $('[data-sessions]');
  if (!mountPoint) return;
  mount(mountPoint, el('div', { class: 'loading-state' }, [
    el('div', { class: 'spinner' }),
    el('span', { text: 'Carregando sessões...' }),
  ]));
}

function renderNotFound(message) {
  const header = $('[data-song-header]');
  const sessions = $('[data-sessions]');
  const primary = $('[data-primary-download]');
  setText($('[data-results-bar]'), '');

  if (primary) clear(primary);
  if (header) clear(header);
  if (sessions) {
    mount(sessions, el('div', { class: 'empty-state' }, [
      icon('alert', { size: 32, class: 'text-faint' }),
      el('h2', { class: 'empty-state__title', text: 'Música não encontrada' }),
      el('p', { class: 'empty-state__text', text: message }),
      el('a', { class: 'btn btn--secondary', href: ROUTES.catalog }, ['Voltar ao catálogo']),
    ]));
  }
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * Escolhe a sessão em destaque: a versão atual mais recentemente atualizada.
 * Evita que a DAW escolhida seja apenas a primeira em ordem alfabética.
 */
function pickPrimarySession() {
  const candidates = state.sessions.filter((session) => session.isCurrent);
  const pool = candidates.length ? candidates : state.sessions;
  if (!pool.length) return null;

  return [...pool].sort((a, b) =>
    String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')),
  )[0];
}
/**
 * KyriosStems - js/pages/admin.js
 * Painel administrativo: dashboard, biblioteca e cadastro em etapas.
 *
 * O acesso é decidido pela API. A verificação daqui serve para não apresentar
 * uma interface que não funcionaria — não é ela que protege os dados.
 */

import { $, clear, el, mount, ready } from '../core/dom.js';
import {
  APP,
  ROUTES,
  DAWS,
  MUSICAL_KEYS,
  TIME_SIGNATURES,
  CATEGORIES,
  AUDIO_FORMATS,
  SAMPLE_RATES,
  BIT_DEPTHS,
  ACCEPTED_EXTENSIONS,
  UPLOAD_LIMITS,
  STORAGE_QUOTA_BYTES,
} from '../core/constants.js';
import { compareText, formatBytes, formatDateTime, unique } from '../core/format.js';
import * as Song from '../models/song.js';
import * as DawSession from '../models/daw-session.js';
import { loadLibrary, statistics } from '../services/library-service.js';
import {
  publishSession,
  classifyFiles,
  describeUpload,
  removeSong,
  ValidationError,
} from '../services/publish-service.js';
import { requireAdmin, signOut } from '../api/auth.js';
import { icon } from '../ui/icons.js';
import { confirmDialog } from '../ui/modal.js';
import { notifyError, notifyInfo, notifySuccess } from '../ui/toast.js';

const state = {
  session: null,
  library: null,
  view: 'dashboard',
  /** Música em edição; null quando é cadastro novo. */
  editingSong: null,
  /** Arquivos escolhidos na etapa 4. */
  files: [],
  wizardStep: 0,
};

const WIZARD_STEPS = [
  { key: 'info', label: 'Informações' },
  { key: 'musical', label: 'Música' },
  { key: 'session', label: 'Sessão' },
  { key: 'files', label: 'Arquivos' },
  { key: 'review', label: 'Publicação' },
];

ready(init);

async function init() {
  const session = await requireAdmin({ redirectTo: ROUTES.login });
  if (!session) return;

  state.session = session;

  renderShell();
  await refreshLibrary();
  showView('dashboard');
}

/* -------------------------------------------------------------------------- */
/* Estrutura                                                                  */
/* -------------------------------------------------------------------------- */

function renderShell() {
  const sidebar = el('aside', { class: 'admin-sidebar' }, [
    el('div', { class: 'admin-sidebar__brand' }, [
      el('a', { class: 'brand', href: ROUTES.catalog }, [
        el('span', { class: 'brand__mark' }, [icon('wave', { size: 18 })]),
        el('span', { class: 'brand__text' }, [
          el('span', { class: 'brand__name', text: APP.name }),
          el('span', { class: 'brand__tagline', text: 'Painel' }),
        ]),
      ]),
    ]),
    el('nav', { class: 'admin-sidebar__nav', 'aria-label': 'Navegação do painel' }, [
      el('p', { class: 'admin-sidebar__section', text: 'Gerenciar' }),
      navItem('dashboard', 'Visão geral', 'dashboard'),
      navItem('library', 'Biblioteca', 'library'),
      navItem('new', 'Nova música', 'plus'),
      el('p', { class: 'admin-sidebar__section', text: 'Sessão' }),
      el('a', { class: 'admin-nav-item', href: ROUTES.catalog }, [
        icon('external', { size: 18 }),
        'Ver catálogo',
      ]),
      el(
        'button',
        { type: 'button', class: 'admin-nav-item', onClick: handleSignOut },
        [icon('logout', { size: 18 }), 'Sair'],
      ),
    ]),
  ]);

  const topbar = el('header', { class: 'admin-topbar' }, [
    el('h1', { class: 'admin-topbar__title', 'data-view-title': true, text: 'Visão geral' }),
    el('div', { class: 'admin-topbar__user' }, [
      icon('lock', { size: 16 }),
      el('span', { text: state.session.user?.email || 'Administrador' }),
    ]),
  ]);

  const main = el('div', { class: 'admin-main' }, [
    topbar,
    el('div', { class: 'admin-content' }, [
      view('dashboard'),
      view('library'),
      view('new'),
    ]),
    el('div', { class: 'admin-statusbar' }, [
      el('span', {}, [
        dot('data-status-api'),
        el('span', { 'data-status-api-text': true, text: 'API: verificando' }),
      ]),
      el('span', {}, [
        dot('data-status-storage'),
        el('span', { 'data-status-storage-text': true, text: 'Drive: verificando' }),
      ]),
    ]),
  ]);

  mount(
    document.body,
    el('div', { class: 'admin-shell' }, [
      sidebar,
      main,
      el('nav', { class: 'bottom-nav', 'aria-label': 'Navegação do painel' }, [
        bottomItem('dashboard', 'Visão geral', 'dashboard'),
        bottomItem('library', 'Biblioteca', 'library'),
        bottomItem('new', 'Nova', 'plus'),
      ]),
    ]),
  );

  function navItem(key, label, iconName) {
    return el(
      'button',
      {
        type: 'button',
        class: 'admin-nav-item',
        'data-nav': key,
        onClick: () => showView(key),
      },
      [icon(iconName, { size: 18 }), label],
    );
  }

  function bottomItem(key, label, iconName) {
    return el(
      'button',
      { type: 'button', class: 'bottom-nav__item', 'data-nav': key, onClick: () => showView(key) },
      [icon(iconName, { size: 22 }), el('span', { text: label })],
    );
  }

  function view(key) {
    return el('section', { class: 'admin-view', 'data-view': key });
  }

  function dot(statusAttr) {
    return el('span', { class: 'admin-statusbar__dot', [statusAttr]: true });
  }
}

function showView(key) {
  state.view = key;

  for (const node of document.querySelectorAll('[data-view]')) {
    node.classList.toggle('is-active', node.dataset.view === key);
  }
  for (const node of document.querySelectorAll('[data-nav]')) {
    node.classList.toggle('is-active', node.dataset.nav === key);
  }

  const titles = {
    dashboard: 'Visão geral',
    library: 'Biblioteca',
    new: state.editingSong ? 'Editar música' : 'Nova música',
  };
  const title = document.querySelector('[data-view-title]');
  if (title) title.textContent = titles[key] || '';

  if (key === 'dashboard') renderDashboard();
  if (key === 'library') renderLibrary();
  if (key === 'new') renderWizard();
}

async function handleSignOut() {
  const confirmed = await confirmDialog({
    title: 'Sair do painel',
    message: 'Você precisará entrar novamente para administrar a biblioteca.',
    confirmLabel: 'Sair',
  });
  if (!confirmed) return;

  await signOut();
  window.location.replace(`${ROUTES.login}?motivo=sessao-encerrada`);
}

/* -------------------------------------------------------------------------- */
/* Dados                                                                      */
/* -------------------------------------------------------------------------- */

async function refreshLibrary() {
  state.library = await loadLibrary();
  updateStatusBar();
}

function updateStatusBar() {
  const { isDemo, error, sessions } = state.library;

  const dot = document.querySelector('[data-status-api]');
  const text = document.querySelector('[data-status-api-text]');
  const connected = !isDemo;

  dot?.classList.toggle('admin-statusbar__dot--on', connected);
  dot?.classList.toggle('admin-statusbar__dot--off', !connected);
  if (text) {
    text.textContent = connected
      ? 'API: conectada'
      : `API: ${error ? 'falha na leitura' : 'não configurada'}`;
  }

  const withPackage = sessions.filter((session) => Boolean(session.packageFileId)).length;
  const storageDot = document.querySelector('[data-status-storage]');
  const storageText = document.querySelector('[data-status-storage-text]');

  storageDot?.classList.toggle('admin-statusbar__dot--on', withPackage > 0);
  storageDot?.classList.toggle('admin-statusbar__dot--off', !isDemo && withPackage === 0);
  if (storageText) {
    storageText.textContent = withPackage
      ? `Drive: ${withPackage} pacote(s)`
      : 'Drive: sem pacotes';
  }
}

/* -------------------------------------------------------------------------- */
/* Visão geral                                                                */
/* -------------------------------------------------------------------------- */

function renderDashboard() {
  const container = document.querySelector('[data-view="dashboard"]');
  if (!container) return;

  const stats = statistics(state.library.songs, state.library.sessions);

  mount(container, [
    el('div', { class: 'stat-grid', style: 'margin-bottom:1.5rem' }, [
      stat('Músicas', String(stats.songs).padStart(2, '0')),
      stat('Sessões', String(stats.sessions).padStart(2, '0')),
      stat('Pacotes', String(stats.packages).padStart(2, '0')),
      stat('Espaço utilizado', formatBytes(stats.bytes), true),
    ]),
    el('div', { class: 'dashboard-grid' }, [
      storageCard(stats),
      recentCard(),
    ]),
  ]);
}

function stat(label, value, accent = false) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat__label', text: label }),
    el('span', { class: `stat__value${accent ? ' stat__value--accent' : ''}`, text: value }),
  ]);
}

/** Ocupação dos pacotes, para referência no painel. */
function storageCard(stats) {
  const percent = Math.min(Math.round((stats.bytes / STORAGE_QUOTA_BYTES) * 100), 100);

  return el('div', { class: 'panel-card' }, [
    el('div', { class: 'panel-card__head' }, [
      icon('disk', { size: 18 }),
      el('h2', { class: 'panel-card__title', text: 'Armazenamento' }),
    ]),
    el('p', { class: 'panel-card__value', text: formatBytes(stats.bytes) }),
    el('p', {
      class: 'panel-card__meta',
      text: `de ${formatBytes(STORAGE_QUOTA_BYTES)} disponíveis no plano gratuito`,
    }),
    el('div', { class: 'progress mt-4' }, [
      el('div', { class: 'progress__bar', style: `width:${percent}%` }),
    ]),
    el('p', { class: 'panel-card__meta', text: `${percent}% utilizado` }),
    el('div', { class: 'panel-card__actions' }, [
      el(
        'button',
        { type: 'button', class: 'btn btn--primary', onClick: () => startNewSong() },
        [icon('upload', { size: 16 }), 'Fazer upload'],
      ),
      el(
        'button',
        { type: 'button', class: 'btn btn--secondary', onClick: () => showView('library') },
        [icon('folder', { size: 16 }), 'Ver biblioteca'],
      ),
    ]),
  ]);
}

/** Últimas músicas adicionadas, com atalho para editar. */
function recentCard() {
  const recent = [...state.library.songs]
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    .slice(0, 5);

  const sessionsBySong = state.library.sessionsBySong;

  return el('div', { class: 'panel-card' }, [
    el('div', { class: 'panel-card__head' }, [
      icon('music', { size: 18 }),
      el('h2', { class: 'panel-card__title', text: 'Adicionadas recentemente' }),
    ]),
    recent.length
      ? el(
          'ul',
          { class: 'recent-list' },
          recent.map((song) => {
            const count = (sessionsBySong.get(song.id) ?? []).length;
            return el('li', { class: 'recent-item' }, [
              el('span', { class: 'recent-item__icon' }, [icon('music', { size: 16 })]),
              el('div', { class: 'recent-item__body' }, [
                el('a', {
                  class: 'recent-item__title',
                  href: `${ROUTES.song}?id=${encodeURIComponent(song.id)}`,
                  text: song.title,
                }),
                el('span', {
                  class: 'recent-item__meta',
                  text: `${formatDateTime(song.updatedAt)} • ${count} sessão(ões)`,
                }),
              ]),
            ]);
          }),
        )
      : el('p', { class: 'text-muted', text: 'Nenhuma música cadastrada ainda.' }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Biblioteca                                                                 */
/* -------------------------------------------------------------------------- */

function renderLibrary() {
  const container = document.querySelector('[data-view="library"]');
  if (!container) return;

  const songs = [...state.library.songs].sort((a, b) => compareText(a.title, b.title));

  mount(container, [
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h2', { class: 'page-header__title', text: 'Biblioteca' }),
        el('p', {
          class: 'page-header__subtitle',
          text: `${songs.length} música(s) • ${state.library.sessions.length} sessão(ões)`,
        }),
      ]),
      el('div', { class: 'page-header__actions' }, [
        el(
          'button',
          { type: 'button', class: 'btn btn--primary', onClick: () => startNewSong() },
          [icon('plus', { size: 16 }), 'Nova música'],
        ),
      ]),
    ]),
    songs.length ? songsTable(songs) : emptyLibrary(),
  ]);
}

function emptyLibrary() {
  return el('div', { class: 'empty-state' }, [
    icon('music', { size: 32, class: 'text-faint' }),
    el('h3', { class: 'empty-state__title', text: 'Biblioteca vazia' }),
    el('p', {
      class: 'empty-state__text',
      text: 'Cadastre a primeira música e envie o pacote da sessão para começar.',
    }),
    el(
      'button',
      { type: 'button', class: 'btn btn--primary', onClick: () => startNewSong() },
      [icon('plus', { size: 16 }), 'Cadastrar música'],
    ),
  ]);
}

function songsTable(songs) {
  const sessionsBySong = state.library.sessionsBySong;

  return el('div', { class: 'table-scroll' }, [
    el('table', { class: 'data-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Música' }),
          el('th', { text: 'Intérprete' }),
          el('th', { text: 'Tom' }),
          el('th', { text: 'BPM' }),
          el('th', { text: 'Sessões' }),
          el('th', { text: 'Atualizada' }),
          el('th', { 'aria-label': 'Ações' }),
        ]),
      ]),
      el(
        'tbody',
        {},
        songs.map((song) => {
          const sessions = sessionsBySong.get(song.id) ?? [];
          return el('tr', {}, [
            cell('Música', song.title, 'title'),
            cell('Intérprete', song.artist || '—'),
            cell('Tom', song.key || '—'),
            cell('BPM', song.bpm ? String(song.bpm) : '—'),
            cell('Sessões', String(sessions.length)),
            cell('Atualizada', formatDateTime(song.updatedAt)),
            el('td', { 'data-label': 'Ações' }, [
              el('div', { class: 'data-table__actions' }, [
                actionButton('external', 'Ver no catálogo', () => {
                  window.open(`${ROUTES.song}?id=${encodeURIComponent(song.id)}`, '_blank');
                }),
                actionButton('edit', 'Editar e adicionar sessão', () => startEditSong(song)),
                actionButton('trash', 'Excluir música', () => handleDeleteSong(song), true),
              ]),
            ]),
          ]);
        }),
      ),
    ]),
  ]);
}

function cell(label, text, variant) {
  return el(
    'td',
    { 'data-label': label, class: variant === 'title' ? 'data-table__title' : null },
    text,
  );
}

function actionButton(iconName, label, onClick, danger = false) {
  return el(
    'button',
    {
      type: 'button',
      class: `icon-btn${danger ? ' icon-btn--danger' : ''}`,
      'aria-label': label,
      title: label,
      onClick,
    },
    [icon(iconName, { size: 16 })],
  );
}

/* -------------------------------------------------------------------------- */
/* Ações sobre músicas e sessões                                              */
/* -------------------------------------------------------------------------- */

async function handleDeleteSong(song) {
  const sessions = state.library.sessionsBySong.get(song.id) ?? [];

  const confirmed = await confirmDialog({
    title: 'Excluir música',
    message: `"${song.title}" será removida junto com ${sessions.length} sessão(ões) e todos os arquivos no Google Drive. Esta ação não pode ser desfeita.`,
    confirmLabel: 'Excluir definitivamente',
    danger: true,
  });
  if (!confirmed) return;

  try {
    notifyInfo('Excluindo...');
    await removeSong(song.id);
    await refreshLibrary();
    renderLibrary();
    notifySuccess(`"${song.title}" foi excluída.`);
  } catch (error) {
    notifyError(error instanceof Error ? error.message : String(error));
  }
}

function startNewSong() {
  state.editingSong = null;
  state.files = [];
  state.wizardStep = 0;
  showView('new');
}

function startEditSong(song) {
  state.editingSong = song;
  state.files = [];
  state.wizardStep = 0;
  showView('new');
}

/* -------------------------------------------------------------------------- */
/* Formulário em etapas                                                       */
/* -------------------------------------------------------------------------- */

/** Campos do formulário, recriados a cada abertura para não reter estado antigo. */
let form = null;

function renderWizard() {
  const container = document.querySelector('[data-view="new"]');
  if (!container) return;

  form = buildForm();

  mount(container, [
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h2', {
          class: 'page-header__title',
          text: state.editingSong ? 'Editar música' : 'Nova música',
        }),
        el('p', {
          class: 'page-header__subtitle',
          text: state.editingSong
            ? 'Atualize os dados e publique uma nova versão de sessão.'
            : 'Cinco etapas: informações, música, sessão, arquivos e publicação.',
        }),
      ]),
      el('div', { class: 'page-header__actions' }, [
        el(
          'button',
          { type: 'button', class: 'btn btn--ghost', onClick: () => showView('library') },
          [icon('arrowLeft', { size: 16 }), 'Voltar'],
        ),
      ]),
    ]),
    el(
      'ol',
      { class: 'wizard-steps' },
      WIZARD_STEPS.map((step, index) =>
        el('li', { class: 'wizard-step', 'data-step': String(index) }, [
          el('span', { class: 'wizard-step__index', text: String(index + 1) }),
          step.label,
        ]),
      ),
    ),
    form.element,
    wizardNav(),
  ]);

  goToStep(state.wizardStep);
}

function wizardNav() {
  const back = el(
    'button',
    { type: 'button', class: 'btn btn--secondary', 'data-wizard-back': true, onClick: () => goToStep(state.wizardStep - 1) },
    [icon('arrowLeft', { size: 16 }), 'Anterior'],
  );

  const next = el(
    'button',
    { type: 'button', class: 'btn btn--primary', 'data-wizard-next': true, onClick: () => goToStep(state.wizardStep + 1) },
    ['Avançar'],
  );

  const publish = el(
    'button',
    { type: 'button', class: 'btn btn--primary', 'data-wizard-publish': true, onClick: handlePublish },
    [icon('upload', { size: 16 }), 'Publicar'],
  );

  return el('div', { class: 'wizard-nav' }, [back, el('span', {}), el('span', { class: 'cluster' }, [next, publish])]);
}

function goToStep(step) {
  const clamped = Math.max(0, Math.min(step, WIZARD_STEPS.length - 1));
  state.wizardStep = clamped;

  for (const node of document.querySelectorAll('[data-step]')) {
    const index = Number(node.dataset.step);
    node.classList.toggle('is-active', index === clamped);
    node.classList.toggle('is-done', index < clamped);
  }
  for (const node of document.querySelectorAll('[data-panel]')) {
    node.classList.toggle('is-active', node.dataset.panel === WIZARD_STEPS[clamped].key);
  }

  const back = document.querySelector('[data-wizard-back]');
  const next = document.querySelector('[data-wizard-next]');
  const publish = document.querySelector('[data-wizard-publish]');

  if (back) back.disabled = clamped === 0;
  if (next) next.hidden = clamped >= WIZARD_STEPS.length - 1;
  if (publish) publish.hidden = clamped < WIZARD_STEPS.length - 1;

  if (WIZARD_STEPS[clamped].key === 'review') renderSummary();
  if (WIZARD_STEPS[clamped].key === 'files') renderUploadPanel();
}

/* -------------------------------------------------------------------------- */
/* Campos                                                                     */
/* -------------------------------------------------------------------------- */

function buildForm() {
  const song = state.editingSong ? { ...state.editingSong } : Song.createSong();
  const session = DawSession.createSession({ songId: song.id });
  const tags = [...(song.tags ?? [])];

  const fields = {
    title: input({ id: 'f-title', value: song.title, required: true }),
    artist: input({ id: 'f-artist', value: song.artist, required: true }),
    album: input({ id: 'f-album', value: song.album }),
    category: select({ id: 'f-category', options: CATEGORIES, value: song.category, placeholder: 'Selecione...' }),
    description: textarea({ id: 'f-description', value: song.description }),
    key: select({ id: 'f-key', options: MUSICAL_KEYS, value: song.key, placeholder: 'Selecione...' }),
    bpm: input({ id: 'f-bpm', value: song.bpm ?? '', type: 'number', attrs: { min: '20', max: '400' } }),
    timeSignature: select({ id: 'f-timesig', options: TIME_SIGNATURES, value: song.timeSignature }),
    duration: input({ id: 'f-duration', value: song.duration ?? '', type: 'number', attrs: { min: '1' }, hint: 'Em segundos' }),
    daw: select({ id: 'f-daw', options: DAWS, value: session.daw, required: true, placeholder: 'Selecione...' }),
    dawVersion: input({ id: 'f-dawversion', value: session.dawVersion, hint: 'Ex.: 7.x, 12, 13' }),
    version: input({ id: 'f-version', value: String(session.version), type: 'number', attrs: { min: '1' } }),
    format: select({ id: 'f-format', options: AUDIO_FORMATS, value: session.format }),
    sampleRate: select({
      id: 'f-samplerate',
      options: SAMPLE_RATES.map((rate) => ({ value: String(rate), label: `${rate} Hz` })),
      value: String(session.sampleRate),
    }),
    bitDepth: select({
      id: 'f-bitdepth',
      options: BIT_DEPTHS.map((depth) => ({ value: String(depth), label: `${depth} bit` })),
      value: String(session.bitDepth),
    }),
    sessionDescription: input({ id: 'f-sessdesc', value: session.description, hint: 'Ex.: guia, click e stems separados' }),
  };

  const tagEditor = buildTagEditor(tags);
  const dropzone = buildDropzone();

  const panels = {
    info: panel('info', [
      el('div', { class: 'form-grid' }, [fields.title, fields.artist, fields.album]),
      el('div', { class: 'form-grid' }, [fields.category, tagEditor.element]),
      fields.description,
    ]),
    musical: panel('musical', [
      el('div', { class: 'form-grid' }, [
        fields.key,
        fields.bpm,
        fields.timeSignature,
        fields.duration,
      ]),
    ]),
    session: panel('session', [
      el('div', { class: 'form-grid' }, [
        fields.daw,
        fields.dawVersion,
        fields.version,
        fields.format,
        fields.sampleRate,
        fields.bitDepth,
      ]),
      fields.sessionDescription,
    ]),
    files: panel('files', [dropzone.element]),
    review: panel('review', []),
  };

  return {
    element: el('div', {}, Object.values(panels)),
    song,
    session,
    fields,
    tags,
    tagEditor,
    dropzone,
    panels,
  };
}

function panel(key, children) {
  return el('div', { class: 'wizard-panel', 'data-panel': key }, children);
}

function input({ id, value = '', type = 'text', required = false, hint = null, attrs = {} }) {
  const control = el('input', {
    id,
    class: 'input',
    type,
    value,
    required,
    ...attrs,
  });

  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id, text: labelFor(id) }),
    control,
    hint ? el('span', { class: 'field__hint', text: hint }) : null,
    errorSlot(id),
  ]);
}

function textarea({ id, value = '' }) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id, text: labelFor(id) }),
    el('textarea', { id, class: 'textarea' }, [value]),
    errorSlot(id),
  ]);
}

function select({ id, options, value = '', placeholder = null, required = false }) {
  const control = el('select', { id, class: 'select', required });
  if (placeholder) control.append(el('option', { value: '', text: placeholder }));
  for (const option of options) {
    const optValue = typeof option === 'object' ? option.value : option;
    const optLabel = typeof option === 'object' ? option.label : option;
    control.append(el('option', { value: optValue, text: optLabel }));
  }
  control.value = value;

  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id, text: labelFor(id) }),
    control,
    errorSlot(id),
  ]);
}

function errorSlot(id) {
  return el('span', { class: 'field__error', 'data-error': id });
}

const LABELS = {
  'f-title': 'Nome',
  'f-artist': 'Intérprete',
  'f-album': 'Álbum',
  'f-category': 'Categoria',
  'f-description': 'Descrição',
  'f-key': 'Tom',
  'f-bpm': 'BPM',
  'f-timesig': 'Compasso',
  'f-duration': 'Duração',
  'f-daw': 'DAW',
  'f-dawversion': 'Versão da DAW',
  'f-version': 'Versão da sessão',
  'f-format': 'Formato',
  'f-samplerate': 'Sample rate',
  'f-bitdepth': 'Bit depth',
  'f-sessdesc': 'Descrição da sessão',
};

function labelFor(id) {
  return LABELS[id] || id;
}

/* -------------------------------------------------------------------------- */
/* Editor de tags                                                              */
/* -------------------------------------------------------------------------- */

function buildTagEditor(initial) {
  const list = el('div', { class: 'tag-editor' });
  const inputField = el('input', {
    class: 'tag-editor__input',
    placeholder: 'Adicione e pressione Enter',
    'aria-label': 'Adicionar tag',
  });

  const render = () => {
    clear(list);
    for (const tag of state.tags ?? []) {
      list.append(
        el('span', { class: 'tag-editor__tag' }, [
          tag,
          el(
            'button',
            {
              type: 'button',
              class: 'tag-editor__remove',
              'aria-label': `Remover ${tag}`,
              onClick: () => {
                removeTag(tag);
                render();
              },
            },
            [icon('close', { size: 12 })],
          ),
        ]),
      );
    }
    list.append(inputField);
  };

  const addTag = () => {
    const value = inputField.value.trim();
    if (!value) return;
    const next = unique([...(state.tags ?? []), value]);
    state.tags = next;
    inputField.value = '';
    render();
  };

  const removeTag = (tag) => {
    state.tags = (state.tags ?? []).filter((item) => item !== tag);
  };

  inputField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
    }
  });
  inputField.addEventListener('blur', addTag);

  state.tags = [...initial];
  render();

  return {
    element: el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: 'Tags' }),
      list,
      el('span', { class: 'field__hint', text: 'Enter ou vírgula para adicionar' }),
    ]),
    getValue: () => [...(state.tags ?? [])],
  };
}

/* -------------------------------------------------------------------------- */
/* Arquivos                                                                   */
/* -------------------------------------------------------------------------- */

function buildDropzone() {
  const input = el('input', {
    type: 'file',
    multiple: true,
    class: 'sr-only',
    accept: ACCEPTED_EXTENSIONS.join(','),
  });

  const zone = el(
    'div',
    {
      class: 'dropzone',
      role: 'button',
      tabindex: '0',
      onClick: () => input.click(),
      onKeydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.click();
        }
      },
      onDragover: (event) => {
        event.preventDefault();
        zone.classList.add('is-dragover');
      },
      onDragleave: () => zone.classList.remove('is-dragover'),
      onDrop: (event) => {
        event.preventDefault();
        zone.classList.remove('is-dragover');
        acceptFiles(event.dataTransfer.files);
      },
    },
    [
      icon('upload', { size: 32, class: 'dropzone__icon' }),
      el('span', { class: 'dropzone__title', text: 'Selecione o ZIP ou os arquivos da sessão' }),
      el('span', {
        class: 'dropzone__hint',
        text: `Aceita ${ACCEPTED_EXTENSIONS.join(', ')} — até ${formatBytes(UPLOAD_LIMITS.maxFileBytes)} por arquivo`,
      }),
      input,
    ],
  );

  input.addEventListener('change', () => acceptFiles(input.files));

  function acceptFiles(fileList) {
    const incoming = Array.from(fileList);
    const tooBig = incoming.filter((file) => file.size > UPLOAD_LIMITS.maxFileBytes);
    if (tooBig.length) {
      notifyError(`Arquivo acima do limite: ${tooBig.map((f) => f.name).join(', ')}`);
      return;
    }
    state.files = incoming;
    renderUploadPanel();
  }

  return { element: zone, input };
}

function renderUploadPanel() {
  const panelElement = document.querySelector('[data-panel="files"]');
  if (!panelElement || !form) return;

  const groups = classifyFiles(state.files);
  const summary = describeUpload(groups);

  const existing = panelElement.querySelector('[data-upload-summary]');
  if (existing) existing.remove();

  const block = el('div', { 'data-upload-summary': true, class: 'mt-4' });

  if (!state.files.length) {
    block.append(
      el('p', { class: 'field__hint', text: 'Nenhum arquivo selecionado ainda.' }),
    );
  } else {
    block.append(
      el('p', { class: 'field__hint', text: `${state.files.length} arquivo(s) • ${summary.totalLabel}` }),
      el(
        'div',
        { class: 'spec-list mt-4' },
        summary.rows.map(([label, count]) =>
          el('div', { class: 'spec' }, [
            el('span', { class: 'spec__label', text: label }),
            el('span', { class: 'spec__value', text: String(count) }),
          ]),
        ),
      ),
      el(
        'ul',
        { class: 'upload-file-list' },
        state.files.slice(0, 40).map((file) =>
          el('li', { class: 'upload-file', 'data-file': file.name }, [
            el('span', { class: 'upload-file__name', text: file.name }),
            el('span', { class: 'upload-file__size', text: formatBytes(file.size) }),
            icon('file', { size: 16, class: 'upload-file__status' }),
          ]),
        ),
      ),
    );
    if (state.files.length > 40) {
      block.append(
        el('p', { class: 'field__hint', text: `...e mais ${state.files.length - 40} arquivo(s).` }),
      );
    }
    if (!groups.package && groups.audio.length === 0 && groups.project.length === 0) {
      block.append(
        el('p', { class: 'alert alert--error mt-4' }, [
          icon('alert', { size: 16 }),
          'Nenhum arquivo reconhecido como pacote, projeto ou áudio. Confira as extensões.',
        ]),
      );
    }
  }

  panelElement.append(block);
}

/* -------------------------------------------------------------------------- */
/* Resumo e publicação                                                        */
/* -------------------------------------------------------------------------- */

/** Lê o formulário para os modelos de domínio, sem validar. */
function collectForm() {
  const value = (id) => document.getElementById(id)?.value ?? '';

  const song = {
    ...form.song,
    title: value('f-title').trim(),
    artist: value('f-artist').trim(),
    album: value('f-album').trim(),
    category: value('f-category'),
    description: value('f-description').trim(),
    key: value('f-key'),
    bpm: value('f-bpm'),
    timeSignature: value('f-timesig'),
    duration: value('f-duration'),
    tags: form.tagEditor.getValue(),
  };

  const session = {
    ...form.session,
    songId: song.id,
    daw: value('f-daw'),
    dawVersion: value('f-dawversion').trim(),
    version: value('f-version'),
    format: value('f-format'),
    sampleRate: value('f-samplerate'),
    bitDepth: value('f-bitdepth'),
    description: value('f-sessdesc').trim(),
    duration: value('f-duration'),
  };

  return { song, session };
}

function renderSummary() {
  const panelElement = document.querySelector('[data-panel="review"]');
  if (!panelElement || !form) return;

  const { song, session } = collectForm();
  const summary = describeUpload(classifyFiles(state.files));

  const rows = [
    ['Música', song.title || '—'],
    ['Intérprete', song.artist || '—'],
    ['Tom', song.key || '—'],
    ['BPM', song.bpm ? String(song.bpm) : '—'],
    ['Compasso', song.timeSignature || '—'],
    ['DAW', session.daw || '—'],
    ['Versão da sessão', `v${session.version || 1}`],
    ['Formato', `${session.format} • ${session.bitDepth} bit • ${session.sampleRate} Hz`],
    ['Arquivos', `${state.files.length} (${summary.totalLabel})`],
  ];

  mount(panelElement, [
    el('div', { class: 'form-block' }, [
      el('h3', { class: 'form-block__title', text: 'Confirme antes de publicar' }),
      el(
        'div',
        { class: 'wizard-summary' },
        rows.map(([key, value]) =>
          el('div', { class: 'wizard-summary__row' }, [
            el('span', { class: 'wizard-summary__key', text: key }),
            el('span', { class: 'wizard-summary__value', text: value }),
          ]),
        ),
      ),
      el('div', { 'data-publish-progress': true, class: 'mt-4' }),
    ]),
  ]);
}

async function handlePublish() {
  const { song, session } = collectForm();
  clearValidation();

  const songCheck = Song.validate(song);
  const sessionCheck = DawSession.validate(session);
  const errors = { ...songCheck.errors, ...sessionCheck.errors };

  if (Object.keys(errors).length) {
    showValidation(errors);
    goToStep(stepWithError(errors));
    notifyError('Corrija os campos destacados antes de publicar.');
    return;
  }

  if (!state.files.length) {
    goToStep(3);
    notifyError('Selecione os arquivos da sessão.');
    return;
  }

  const publishButton = document.querySelector('[data-wizard-publish]');
  if (publishButton) publishButton.disabled = true;

  const progressMount = document.querySelector('[data-publish-progress]');
  const bar = el('div', { class: 'progress__bar' });
  const status = el('p', { class: 'field__hint', text: 'Enviando...' });

  if (progressMount) {
    mount(progressMount, [status, el('div', { class: 'progress mt-4' }, [bar])]);
  }

  try {
    const result = await publishSession({
      song,
      isNewSong: !state.editingSong,
      session,
      files: state.files,
      onProgress: (percent, fileName) => {
        bar.style.width = `${percent}%`;
        status.textContent = `Enviando ${fileName ?? ''} — ${percent}%`;
      },
      onFileStatus: (fileName, fileStatus) => {
        const row = document.querySelector(`[data-file="${CSS.escape(fileName)}"]`);
        if (!row) return;
        row.classList.toggle('is-uploaded', fileStatus === 'uploaded');
        row.classList.toggle('is-error', fileStatus === 'error');
      },
    });

    notifySuccess(`"${result.song.title}" publicada com sucesso.`);
    await refreshLibrary();
    resetWizard();
    showView('library');
  } catch (error) {
    if (error instanceof ValidationError) {
      showValidation(error.errors);
      goToStep(stepWithError(error.errors));
      notifyError('Corrija os campos destacados.');
    } else {
      notifyError(error instanceof Error ? error.message : String(error));
      if (progressMount) {
        mount(progressMount, el('p', { class: 'alert alert--error mt-4' }, [
          icon('alert', { size: 16 }),
          'O envio falhou. Nenhuma sessão foi registrada; tente novamente.',
        ]));
      }
    }
  } finally {
    if (publishButton) publishButton.disabled = false;
  }
}

function resetWizard() {
  state.editingSong = null;
  state.files = [];
  state.tags = [];
  state.wizardStep = 0;
}

/* -------------------------------------------------------------------------- */
/* Erros de validação                                                         */
/* -------------------------------------------------------------------------- */

const ERROR_FIELD_MAP = {
  title: 'f-title',
  artist: 'f-artist',
  bpm: 'f-bpm',
  duration: 'f-duration',
  songId: 'f-daw',
  daw: 'f-daw',
  version: 'f-version',
  sampleRate: 'f-samplerate',
  bitDepth: 'f-bitdepth',
};

function clearValidation() {
  for (const node of document.querySelectorAll('[data-error]')) node.textContent = '';
  for (const node of document.querySelectorAll('.input, .select')) {
    node.removeAttribute('aria-invalid');
  }
}

/**
 * Descobre em qual etapa está o primeiro campo com erro, para levar o usuário
 * direto até ele em vez de sempre voltar ao início do formulário.
 */
function stepWithError(errors) {
  const controls = new Set(
    Object.keys(errors).map((field) => ERROR_FIELD_MAP[field] || field),
  );

  for (let index = 0; index < WIZARD_STEPS.length; index += 1) {
    const panel = document.querySelector(`[data-panel="${WIZARD_STEPS[index].key}"]`);
    if (!panel) continue;
    for (const control of controls) {
      if (panel.querySelector(`#${CSS.escape(control)}`)) return index;
    }
  }

  return 0;
}

function showValidation(errors) {
  clearValidation();

  for (const [field, message] of Object.entries(errors)) {
    const controlId = ERROR_FIELD_MAP[field] || field;
    const errorNode = document.querySelector(`[data-error="${controlId}"]`);
    const control = document.getElementById(controlId);

    if (errorNode) errorNode.textContent = message;
    if (control) control.setAttribute('aria-invalid', 'true');
  }
}

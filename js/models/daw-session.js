/**
 * KyriosStems - js/models/daw-session.js
 * Entidade DawSession: uma versão de uma música preparada para uma DAW.
 */

import { createId, normalizeText, compareText } from '../core/format.js';

/**
 * @typedef {Object} SessionFile
 * @property {string} name       Nome exibido
 * @property {string} path       Caminho relativo dentro do pacote
 * @property {string} fileId     Identificador do arquivo no Google Drive
 * @property {number} size       Bytes
 * @property {string} category   package | project | audio | aux
 * @property {string} contentType
 */

/**
 * @typedef {Object} DawSession
 * @property {string} id
 * @property {string} songId
 * @property {string} daw
 * @property {string} dawVersion
 * @property {number} version
 * @property {string} description
 * @property {string} format
 * @property {number|null} sampleRate
 * @property {number|null} bitDepth
 * @property {number|null} duration
 * @property {string} packageFileId Id do ZIP no Google Drive
 * @property {number|null} packageSize
 * @property {SessionFile[]} files
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const SESSION_FIELDS = [
  'songId',
  'daw',
  'dawVersion',
  'version',
  'description',
  'format',
  'sampleRate',
  'bitDepth',
  'duration',
  'packageFileId',
  'packageSize',
  'files',
  'createdAt',
  'updatedAt',
];

/** @returns {DawSession} */
export function createSession(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || createId('session'),
    songId: '',
    daw: '',
    dawVersion: '',
    version: 1,
    description: '',
    format: 'WAV',
    sampleRate: 48000,
    bitDepth: 24,
    duration: null,
    packageFileId: '',
    packageSize: null,
    files: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function fromDocument(docId, data = {}) {
  return createSession({
    ...data,
    id: data.id || docId,
    version: Number(data.version) || 1,
    sampleRate: toNumberOrNull(data.sampleRate),
    bitDepth: toNumberOrNull(data.bitDepth),
    duration: toNumberOrNull(data.duration),
    packageSize: toNumberOrNull(data.packageSize),
    files: Array.isArray(data.files) ? data.files : [],
  });
}
export function toDocument(session) {
  const payload = {};
  for (const field of SESSION_FIELDS) {
    if (session[field] !== undefined) payload[field] = session[field];
  }
  payload.version = Number(session.version) || 1;
  payload.sampleRate = toNumberOrNull(session.sampleRate);
  payload.bitDepth = toNumberOrNull(session.bitDepth);
  payload.duration = toNumberOrNull(session.duration);
  payload.packageSize = toNumberOrNull(session.packageSize);
  payload.updatedAt = new Date().toISOString();
  return payload;
}

/** @returns {{ valid: boolean, errors: Record<string,string> }} */
export function validate(session) {
  const errors = {};

  if (!String(session.songId ?? '').trim()) {
    errors.songId = 'A sessão precisa estar vinculada a uma música.';
  }
  if (!String(session.daw ?? '').trim()) {
    errors.daw = 'Informe a DAW da sessão.';
  }
  const version = Number(session.version);
  if (!Number.isInteger(version) || version < 1) {
    errors.version = 'A versão deve ser um número inteiro maior ou igual a 1.';
  }
  if (session.sampleRate !== null && session.sampleRate !== '' && session.sampleRate !== undefined) {
    const rate = Number(session.sampleRate);
    if (!Number.isFinite(rate) || rate <= 0) errors.sampleRate = 'Sample rate inválido.';
  }
  if (session.bitDepth !== null && session.bitDepth !== '' && session.bitDepth !== undefined) {
    const depth = Number(session.bitDepth);
    if (!Number.isFinite(depth) || depth <= 0) errors.bitDepth = 'Bit depth inválido.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Rótulo curto da versão: "v1", "v2"... */
export function versionLabel(session) {
  return `v${Number(session.version) || 1}`;
}

/** Nome sugerido do arquivo ZIP baixado. */
export function packageFileName(song, session) {
  const parts = [song?.title || 'sessao', session?.daw || 'daw', versionLabel(session)];
  return `${parts.join(' - ')}.zip`;
}

/** Comparador: maior versão primeiro. */
export function byVersionDesc(a, b) {
  return (Number(b.version) || 0) - (Number(a.version) || 0);
}

/** Comparador por DAW e depois por versão decrescente. */
export function byDawThenVersion(a, b) {
  const daw = compareText(a.daw, b.daw);
  return daw !== 0 ? daw : byVersionDesc(a, b);
}

/** Texto pesquisável de uma sessão. */
export function searchIndex(session) {
  return normalizeText([session.daw, session.dawVersion, session.description, session.format].join(' '));
}

/** Agrupa sessões por DAW, ordenando versões da mais recente para a mais antiga. */
export function groupByDaw(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const key = session.daw || 'Sem DAW';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
  }
  for (const list of groups.values()) list.sort(byVersionDesc);
  return new Map([...groups.entries()].sort((a, b) => compareText(a[0], b[0])));
}

/** Marca a versão mais recente de cada DAW como atual. */
export function markCurrentVersions(sessions) {
  const latest = new Map();
  for (const session of sessions) {
    const key = session.daw || '';
    const current = latest.get(key);
    if (!current || (Number(session.version) || 0) > (Number(current.version) || 0)) {
      latest.set(key, session);
    }
  }
  const currentIds = new Set([...latest.values()].map((session) => session.id));
  return sessions.map((session) => ({ ...session, isCurrent: currentIds.has(session.id) }));
}

/** Próximo número de versão para uma DAW dentro de uma música. */
export function nextVersion(sessions, songId, daw) {
  const versions = sessions
    .filter((session) => session.songId === songId && session.daw === daw)
    .map((session) => Number(session.version) || 0);

  return versions.length ? Math.max(...versions) + 1 : 1;
}

/** Agrupa arquivos por categoria, na ordem canônica. */
export function groupFiles(files) {
  const order = ['package', 'project', 'audio', 'aux'];
  const groups = new Map();
  for (const file of files ?? []) {
    const key = file.category || 'aux';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => compareText(a.name, b.name));
  }
  return new Map([...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])));
}


function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
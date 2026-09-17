/**
 * KyriosStems - js/models/song.js
 * Entidade Song: a música como item da biblioteca.
 *
 * A música NÃO possui arquivos diretamente. Arquivos pertencem a DawSession.
 */

import { createId, normalizeText, unique, compareText } from '../core/format.js';

/**
 * @typedef {Object} Song
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string} album
 * @property {string} key          Tom (ex.: "E", "Am")
 * @property {number|null} bpm
 * @property {string} timeSignature
 * @property {number|null} duration Segundos
 * @property {string} category
 * @property {string[]} tags
 * @property {string} coverUrl
 * @property {string} description
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** Campos persistidos, na ordem canônica. */
export const SONG_FIELDS = [
  'id',
  'title',
  'artist',
  'album',
  'key',
  'bpm',
  'timeSignature',
  'duration',
  'category',
  'tags',
  'coverUrl',
  'description',
  'createdAt',
  'updatedAt',
];

/** @returns {Song} */
export function createSong(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || createId('song'),
    title: '',
    artist: '',
    album: '',
    key: '',
    bpm: null,
    timeSignature: '4/4',
    duration: null,
    category: '',
    tags: [],
    coverUrl: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Normaliza um documento vindo do Firestore para o formato do domínio. */
export function fromDocument(docId, data = {}) {
  return createSong({
    ...data,
    id: data.id || docId,
    tags: Array.isArray(data.tags) ? data.tags : [],
    bpm: toNumberOrNull(data.bpm),
    duration: toNumberOrNull(data.duration),
  });
}

/** Converte o modelo em payload persistível (sem campos derivados). */
export function toDocument(song) {
  const payload = {};
  for (const field of SONG_FIELDS) {
    if (field === 'id') continue;
    if (song[field] !== undefined) payload[field] = song[field];
  }
  payload.tags = unique(song.tags ?? []);
  payload.bpm = toNumberOrNull(song.bpm);
  payload.duration = toNumberOrNull(song.duration);
  payload.updatedAt = new Date().toISOString();
  return payload;
}

/**
 * Valida uma música antes de persistir.
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validate(song) {
  const errors = {};

  if (!String(song.title ?? '').trim()) {
    errors.title = 'Informe o nome da música.';
  }
  if (!String(song.artist ?? '').trim()) {
    errors.artist = 'Informe o intérprete/artista.';
  }
  if (song.bpm !== null && song.bpm !== '' && song.bpm !== undefined) {
    const bpm = Number(song.bpm);
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) {
      errors.bpm = 'BPM deve estar entre 20 e 400.';
    }
  }
  if (song.duration !== null && song.duration !== '' && song.duration !== undefined) {
    const duration = Number(song.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.duration = 'Duração deve ser maior que zero.';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Texto pesquisável de uma música (título, artista, álbum, categoria, tags). */
export function searchIndex(song) {
  return normalizeText(
    [song.title, song.artist, song.album, song.category, song.key, ...(song.tags ?? [])].join(' '),
  );
}

/** Comparador para ordenação alfabética por título. */
export function byTitle(a, b) {
  return compareText(a.title, b.title);
}


function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
/**
 * KyriosStems - js/services/library-service.js
 * Regras da biblioteca: carrega o catálogo, agrupa e deriva facetas de filtro.
 *
 * Fica entre os repositórios (Firestore) e a apresentação, para que as páginas
 * não conheçam detalhes de persistência.
 */

import { fetchSongs, fetchSessions, fetchSong, fetchSessionsBySong, getLastSource } from '../repositories/firestore-repository.js';
import { groupByDaw, markCurrentVersions, byDawThenVersion } from '../models/daw-session.js';
import { compareText, unique } from '../core/format.js';
import { byTitle } from '../models/song.js';

/**
 * @typedef {Object} LibrarySnapshot
 * @property {import('../models/song.js').Song[]} songs
 * @property {import('../models/daw-session.js').DawSession[]} sessions
 * @property {Map<string, import('../models/daw-session.js').DawSession[]>} sessionsBySong
 * @property {string} source
 * @property {string|null} error
 * @property {LibraryFacets} facets
 */

/**
 * @typedef {Object} LibraryFacets
 * @property {string[]} artists
 * @property {string[]} keys
 * @property {string[]} categories
 * @property {string[]} daws
 * @property {number} sessionCount
 * @property {number} totalBytes
 */

/** Carrega toda a biblioteca e deriva as facetas de filtro. */
export async function loadLibrary() {
  const [songsResult, sessionsResult] = await Promise.all([fetchSongs(), fetchSessions()]);

  const sessionsBySong = new Map();
  for (const session of sessionsResult.items) {
    if (!sessionsBySong.has(session.songId)) sessionsBySong.set(session.songId, []);
    sessionsBySong.get(session.songId).push(session);
  }

  return {
    songs: [...songsResult.items].sort(byTitle),
    sessions: sessionsResult.items,
    sessionsBySong,
    source: sessionsResult.source === 'demo' ? sessionsResult.source : getLastSource() ?? songsResult.source,
    error: songsResult.error || sessionsResult.error,
    facets: buildFacets(songsResult.items, sessionsResult.items),
  };
}

/** Carrega uma música e suas sessões, com as versões já marcadas. */
export async function loadSongDetail(songId) {
  const [songResult, sessionsResult] = await Promise.all([
    fetchSong(songId),
    fetchSessionsBySong(songId),
  ]);

  const ordered = [...sessionsResult.items].sort(byDawThenVersion);
  const sessions = markCurrentVersions(ordered).sort(byDawThenVersion);

  return {
    song: songResult.item,
    sessions,
    byDaw: groupByDaw(sessions),
    source: sessionsResult.source,
    error: songResult.error || sessionsResult.error,
  };
}

/** Deriva as opções de filtro a partir dos dados carregados. */
export function buildFacets(songs, sessions) {
  const sessionCount = sessions.length;
  const totalBytes = sessions.reduce(
    (sum, session) => sum + (Number(session.packageSize) || 0),
    0,
  );

  return {
    artists: unique(songs.map((song) => song.artist)).sort(compareText),
    keys: unique(songs.map((song) => song.key)).sort(compareText),
    categories: unique(songs.map((song) => song.category)).sort(compareText),
    daws: unique(sessions.map((session) => session.daw)).sort(compareText),
    sessionCount,
    totalBytes,
  };
}

/** Filtra a biblioteca por texto de busca. */
export function searchLibrary(songs, term, searchIndexOf) {
  const needle = String(term ?? '').trim();
  if (!needle) return songs;

  const normalized = searchIndexOf(needle);
  return songs.filter((song) => searchIndexOf(song).includes(normalized));
}

/** Estatísticas do dashboard administrativo. */
export function statistics(library) {
  return {
    songs: library.songs.length,
    sessions: library.facets.sessionCount,
    packages: library.sessions.filter((session) => Boolean(session.packagePath)).length,
    bytes: library.facets.totalBytes,
  };
}
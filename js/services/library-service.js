/**
 * KyriosStems - js/services/library-service.js
 * Regras da biblioteca: carrega o catálogo, agrupa e deriva facetas de filtro.
 *
 * Fica entre os repositórios (Firestore) e a apresentação, para que as páginas
 * não conheçam detalhes de persistência.
 */

import {
  fetchSongs,
  fetchSessions,
  fetchSong,
  fetchSessionsBySong,
} from '../repositories/firestore-repository.js';
import { groupByDaw, markCurrentVersions, byDawThenVersion } from '../models/daw-session.js';
import { compareText, normalizeText, unique } from '../core/format.js';
import { byTitle, searchIndex as songSearchIndex } from '../models/song.js';

/**
 * @typedef {Object} LibraryFacets
 * @property {string[]} artists
 * @property {string[]} keys
 * @property {string[]} categories
 * @property {string[]} daws
 * @property {number} sessionCount
 * @property {number} totalBytes
 */

/**
 * Carrega toda a biblioteca e deriva as facetas de filtro.
 * `isDemo` e `error` permitem à interface avisar que os dados não são reais.
 */
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
    isDemo: isDemo(songsResult, sessionsResult),
    error: songsResult.error || sessionsResult.error,
    facets: buildFacets(songsResult.items, sessionsResult.items),
  };
}

/** Carrega uma música e suas sessões, com as versões atuais já marcadas. */
export async function loadSongDetail(songId) {
  const [songResult, sessionsResult] = await Promise.all([
    fetchSong(songId),
    fetchSessionsBySong(songId),
  ]);

  const sessions = markCurrentVersions([...sessionsResult.items].sort(byDawThenVersion));

  return {
    song: songResult.item,
    sessions: sessions.sort(byDawThenVersion),
    byDaw: groupByDaw(sessions),
    isDemo: isDemo(songResult, sessionsResult),
    error: songResult.error || sessionsResult.error,
  };
}

/** Deriva as opções de filtro a partir dos dados carregados. */
export function buildFacets(songs, sessions) {
  return {
    artists: unique(songs.map((song) => song.artist)).sort(compareText),
    keys: unique(songs.map((song) => song.key)).sort(compareText),
    categories: unique(songs.map((song) => song.category)).sort(compareText),
    daws: unique(sessions.map((session) => session.daw)).sort(compareText),
    sessionCount: sessions.length,
    totalBytes: sessions.reduce((sum, session) => sum + (Number(session.packageSize) || 0), 0),
  };
}

/** Filtra músicas pelo termo de busca (título, intérprete, álbum, tags). */
export function searchSongs(songs, term) {
  const needle = normalizeText(term);
  if (!needle) return songs;
  return songs.filter((song) => songSearchIndex(song).includes(needle));
}

/** Estatísticas do dashboard administrativo. */
export function statistics(songs, sessions) {
  return {
    songs: songs.length,
    sessions: sessions.length,
    packages: sessions.filter((session) => Boolean(session.packagePath)).length,
    bytes: sessions.reduce((sum, session) => sum + (Number(session.packageSize) || 0), 0),
  };
}

function isDemo(...results) {
  return results.some((result) => result.source === 'demo');
}
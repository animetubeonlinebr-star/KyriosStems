/**
 * KyriosStems - js/repositories/library-repository.js
 * Persistência de músicas e sessões na API.
 *
 * O contrato de retorno é `{ items, source, error }`, para que a camada de
 * serviço e as páginas não precisem saber de onde os dados vieram.
 *
 * Comportamento de leitura:
 * - API inalcançável: devolve a biblioteca de demonstração JUNTO com o erro,
 *   para que a interface avise que os dados exibidos não são reais. Sem esse
 *   aviso, o usuário acreditaria estar vendo a biblioteca verdadeira.
 *
 * Escritas nunca degradam: falham explicitamente, porque só o administrador
 * escreve e um erro silencioso aqui seria destrutivo.
 */

import { get, post, patch, del } from '../api/client.js';
import { demoLibrary } from '../data/demo-data.js';
import * as Song from '../models/song.js';
import * as DawSession from '../models/daw-session.js';

/** Origem dos dados de uma leitura. */
export const SOURCE = {
  api: 'api',
  demo: 'demo',
};

/* -------------------------------------------------------------------------- */
/* Leituras                                                                    */
/* -------------------------------------------------------------------------- */

/** Lê todas as músicas e sessões de uma vez. */
export async function fetchLibrary() {
  try {
    const data = await get('/api/library');
    return {
      songs: (data.songs ?? []).map((row) => Song.fromDocument(row.id, row)),
      sessions: (data.sessions ?? []).map((row) => DawSession.fromDocument(row.id, row)),
      source: SOURCE.api,
      error: null,
    };
  } catch (error) {
    return {
      songs: demoSongs(),
      sessions: demoSessions(),
      source: SOURCE.demo,
      error: describe(error),
    };
  }
}

/** Lê todas as músicas. Mantido para compatibilidade com o serviço. */
export async function fetchSongs() {
  const result = await fetchLibrary();
  return { items: result.songs, source: result.source, error: result.error };
}

/** Lê todas as sessões. */
export async function fetchSessions() {
  const result = await fetchLibrary();
  return { items: result.sessions, source: result.source, error: result.error };
}

/** Lê uma música pelo id. */
export async function fetchSong(songId) {
  try {
    const data = await get(`/api/songs/${encodeURIComponent(songId)}`);
    return {
      item: Song.fromDocument(data.song.id, data.song),
      source: SOURCE.api,
      error: null,
    };
  } catch (error) {
    if (error?.status === 404) {
      return { item: null, source: SOURCE.api, error: null };
    }
    const demo = demoLibrary().find((entry) => entry.song.id === songId)?.song ?? null;
    return { item: demo, source: SOURCE.demo, error: describe(error) };
  }
}

/** Lê as sessões de uma música. */
export async function fetchSessionsBySong(songId) {
  try {
    const data = await get(`/api/songs/${encodeURIComponent(songId)}`);
    const sessions = (data.sessions ?? []).map((row) => DawSession.fromDocument(row.id, row));
    return { items: sessions, source: SOURCE.api, error: null };
  } catch (error) {
    const demo = demoLibrary().find((entry) => entry.song.id === songId)?.sessions ?? [];
    return { items: demo, source: SOURCE.demo, error: describe(error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Escritas (somente administrador)                                            */
/* -------------------------------------------------------------------------- */

/** Cria uma música. */
export async function createSong(song) {
  const data = await post('/api/songs', { song }, { auth: true });
  return Song.fromDocument(data.song.id, data.song);
}

/** Atualiza campos de uma música. */
export async function updateSong(songId, changes) {
  const data = await patch(`/api/songs/${encodeURIComponent(songId)}`, changes, { auth: true });
  return Song.fromDocument(data.song.id, data.song);
}

/** Exclui uma música e todas as suas sessões. */
export function deleteSong(songId) {
  return del(`/api/songs/${encodeURIComponent(songId)}`, { auth: true });
}

/** Cria uma sessão com os arquivos já registrados. */
export async function createSession(session, files) {
  const data = await post('/api/sessions', { session, files }, { auth: true });
  return DawSession.fromDocument(data.session.id, data.session);
}

/** Atualiza campos de uma sessão. */
export async function updateSession(sessionId, changes) {
  const data = await patch(`/api/sessions/${encodeURIComponent(sessionId)}`, changes, { auth: true });
  return DawSession.fromDocument(data.session.id, data.session);
}

/** Exclui uma sessão. */
export function deleteSession(sessionId) {
  return del(`/api/sessions/${encodeURIComponent(sessionId)}`, { auth: true });
}

/** Próxima versão de uma DAW, calculada pelo servidor. */
export async function fetchNextVersion(songId, daw) {
  const data = await get(
    `/api/songs/${encodeURIComponent(songId)}/next-version?daw=${encodeURIComponent(daw)}`,
    { auth: true },
  );
  return data.version;
}

/* -------------------------------------------------------------------------- */

function demoSongs() {
  return demoLibrary().map((entry) => entry.song);
}

function demoSessions() {
  return demoLibrary().flatMap((entry) => entry.sessions);
}

/** Traduz erros da API em mensagens acionáveis. */
function describe(error) {
  if (error?.status === 0 || /Failed to fetch|NetworkError/i.test(error?.message || '')) {
    return 'Não foi possível falar com a API. Verifique se o backend está no ar e se o endereço em js/core/config.js está correto.';
  }
  if (error?.status === 403) {
    return 'Acesso negado pela API.';
  }
  return error?.message || String(error);
}
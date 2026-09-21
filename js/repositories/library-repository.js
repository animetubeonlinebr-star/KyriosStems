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

import { get, post, patch, del, API_NOT_CONFIGURED } from '../api/client.js';
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

/**
 * Lê uma música e suas sessões em uma única requisição.
 *
 * A rota já devolve as duas coisas, então pedir música e sessões em chamadas
 * separadas dobraria o tráfego por página — a biblioteca inteira era baixada
 * duas vezes no catálogo.
 */
export async function fetchSongDetail(songId) {
  try {
    const data = await get(`/api/songs/${encodeURIComponent(songId)}`);
    return {
      song: Song.fromDocument(data.song.id, data.song),
      sessions: (data.sessions ?? []).map((row) => DawSession.fromDocument(row.id, row)),
      source: SOURCE.api,
      error: null,
    };
  } catch (error) {
    // 404 é resposta legítima: a música não existe. Não é degradação.
    if (error?.status === 404) {
      return { song: null, sessions: [], source: SOURCE.api, error: null };
    }
    const entry = demoLibrary().find((item) => item.song.id === songId);
    return {
      song: entry?.song ?? null,
      sessions: entry?.sessions ?? [],
      source: SOURCE.demo,
      error: describe(error),
    };
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
  // "Não configurado" não é falha de rede: a requisição nem saiu. A mensagem
  // original já diz o que fazer, então é preservada.
  if (error?.status !== API_NOT_CONFIGURED
      && (error?.status === 0 || /Failed to fetch|NetworkError/i.test(error?.message || ''))) {
    return 'Não foi possível falar com a API. Verifique se o backend está no ar e se o endereço em js/core/config.js está correto.';
  }
  if (error?.status === 403) {
    return 'Acesso negado pela API.';
  }
  return error?.message || String(error);
}
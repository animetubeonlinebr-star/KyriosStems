/**
 * KyriosStems - js/repositories/drive-repository.js
 * Leitura da biblioteca no Google Drive.
 *
 * A pasta no Drive é a fonte da verdade. Não há banco de dados: cada música é
 * uma pasta, cada sessão é uma subpasta, e um `song.json` opcional acrescenta
 * os metadados que o nome da pasta não carrega (intérprete, tom, BPM, tags).
 *
 * Só há leitura aqui. Escrever no Drive exige autorização OAuth, que nesta
 * etapa não existe: a biblioteca é alimentada arrastando pastas no Drive.
 *
 * O contrato de retorno é `{ items, source, error }`, o mesmo do resto da
 * aplicação, para que a camada de serviço não precise conhecer o provedor.
 */

import {
  driveUrl,
  driveRootFolderId,
  isDriveConfigured,
  SONG_METADATA_FILE,
  COVER_FILE_NAMES,
} from '../core/config.js';
import { withTimeout } from '../core/async.js';
import { NETWORK, EXTENSION_CATEGORY, PACKAGE_FILE_NAME } from '../core/constants.js';
import { fileExtension } from '../core/format.js';
import { demoLibrary } from '../data/demo-data.js';
import * as Song from '../models/song.js';
import * as DawSession from '../models/daw-session.js';

/** Origem dos dados de uma leitura. */
export const SOURCE = {
  drive: 'drive',
  demo: 'demo',
};

export { isDriveConfigured };

/* -------------------------------------------------------------------------- */
/* API do Drive                                                               */
/* -------------------------------------------------------------------------- */

/** Lista os filhos diretos de uma pasta. */
async function listChildren(folderId) {
  const url = driveUrl('/files', {
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,createdTime)',
    pageSize: 1000,
    orderBy: 'name',
  });

  const response = await withTimeout(
    fetch(url),
    NETWORK.readTimeoutMs,
    'listar a biblioteca no Drive',
  );

  if (!response.ok) throw new Error(await describeHttpError(response));
  const data = await response.json();
  return data.files ?? [];
}

/** Lê um arquivo como texto. Usado para o `song.json`. */
async function readTextFile(fileId) {
  const response = await withTimeout(
    fetch(driveUrl(`/files/${encodeURIComponent(fileId)}`, { alt: 'media' })),
    NETWORK.readTimeoutMs,
    'ler os metadados da música',
  );

  if (!response.ok) return null;
  return response.text();
}

/** Link direto de download de um arquivo. */
export function downloadUrlFor(fileId) {
  return driveUrl(`/files/${encodeURIComponent(fileId)}`, { alt: 'media' });
}

/* -------------------------------------------------------------------------- */
/* Leitura da biblioteca                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Lê toda a biblioteca a partir da pasta raiz.
 *
 * Cada pasta de primeiro nível é uma música; cada subpasta dela é uma sessão.
 * Uma leitura falha degrada para a biblioteca de demonstração JUNTO com o erro,
 * para que a interface avise que os dados exibidos não são reais.
 */
export async function fetchLibrary() {
  if (!isDriveConfigured()) {
    return {
      songs: demoSongs(),
      sessions: demoSessions(),
      source: SOURCE.demo,
      error: null,
      notConfigured: true,
    };
  }

  try {
    const songFolders = await listChildren(driveRootFolderId);
    const songs = [];
    const sessions = [];

    for (const folder of songFolders) {
      if (!isFolder(folder)) continue;
      const detail = await readSongFolder(folder);
      songs.push(detail.song);
      sessions.push(...detail.sessions);
    }

    return { songs, sessions, source: SOURCE.drive, error: null, notConfigured: false };
  } catch (error) {
    return {
      songs: demoSongs(),
      sessions: demoSessions(),
      source: SOURCE.demo,
      error: describe(error),
      notConfigured: false,
    };
  }
}

/** Lê uma música e suas sessões a partir da pasta. */
export async function fetchSongDetail(folderId) {
  if (!isDriveConfigured()) {
    const entry = demoLibrary().find((item) => item.song.id === folderId);
    return {
      song: entry?.song ?? null,
      sessions: entry?.sessions ?? [],
      source: SOURCE.demo,
      error: null,
      notConfigured: true,
    };
  }

  try {
    const folder = await getFolder(folderId);
    if (!folder) {
      return { song: null, sessions: [], source: SOURCE.drive, error: null, notConfigured: false };
    }

    const detail = await readSongFolder(folder);
    return { ...detail, source: SOURCE.drive, error: null, notConfigured: false };
  } catch (error) {
    const entry = demoLibrary().find((item) => item.song.id === folderId);
    return {
      song: entry?.song ?? null,
      sessions: entry?.sessions ?? [],
      source: SOURCE.demo,
      error: describe(error),
      notConfigured: false,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Montagem a partir da estrutura de pastas                                    */
/* -------------------------------------------------------------------------- */

/** Lê uma pasta de música: metadados, capa e sessões. */
async function readSongFolder(folder) {
  const children = await listChildren(folder.id);

  const metadata = await readMetadata(children, folder.name);
  const cover = children.find((child) => COVER_FILE_NAMES.includes(child.name.toLowerCase()));

  const sessionFolders = children.filter(isFolder);
  const sessions = [];

  for (const sessionFolder of sessionFolders) {
    sessions.push(await readSessionFolder(sessionFolder, folder.id, metadata));
  }

  const song = Song.fromDriveFolder(folder, {
    ...metadata,
    coverUrl: cover ? downloadUrlFor(cover.id) : '',
  });

  return { song, sessions };
}

/** Metadados do `song.json`, quando existir. */
async function readMetadata(children, folderName) {
  const file = children.find((child) => child.name === SONG_METADATA_FILE);
  if (!file) return { title: folderName };

  try {
    const text = await readTextFile(file.id);
    const parsed = text ? JSON.parse(text) : {};
    return { ...parsed, title: parsed.title || folderName };
  } catch {
    // Metadados inválidos não derrubam a música: o nome da pasta já é útil.
    return { title: folderName };
  }
}

/** Lê uma pasta de sessão: arquivos e a DAW inferida. */
async function readSessionFolder(sessionFolder, songId, metadata) {
  const children = await listChildren(sessionFolder.id);

  const files = children
    .filter((child) => !isFolder(child))
    .map((child) => toSessionFile(child));

  const packageFile = files.find((file) => file.category === 'package') ?? null;
  const override = (metadata.sessions ?? {})[sessionFolder.name] ?? {};

  return DawSession.fromDriveFolder(sessionFolder, {
    songId,
    files,
    packageFileId: packageFile?.fileId ?? '',
    packageSize: packageFile?.size ?? null,
    ...override,
  });
}

/** Converte um arquivo do Drive no formato de arquivo da sessão. */
function toSessionFile(file) {
  return {
    name: file.name,
    path: file.name,
    fileId: file.id,
    size: Number(file.size) || 0,
    category: categorize(file.name),
    contentType: '',
    url: downloadUrlFor(file.id),
  };
}

/** Deriva a categoria de um arquivo a partir da extensão. */
export function categorize(fileName) {
  return EXTENSION_CATEGORY[fileExtension(fileName)] || 'aux';
}

/** Confirma que um id ainda existe e é pasta. */
async function getFolder(folderId) {
  const url = driveUrl(`/files/${encodeURIComponent(folderId)}`, {
    fields: 'id,name,mimeType,createdTime,modifiedTime',
  });

  try {
    const response = await withTimeout(fetch(url), NETWORK.readTimeoutMs, 'ler a música no Drive');
    if (!response.ok) return null;
    const file = await response.json();
    return isFolder(file) ? file : null;
  } catch {
    return null;
  }
}

function isFolder(file) {
  return file?.mimeType === 'application/vnd.google-apps.folder';
}

/* -------------------------------------------------------------------------- */

function demoSongs() {
  return demoLibrary().map((entry) => entry.song);
}

function demoSessions() {
  return demoLibrary().flatMap((entry) => entry.sessions);
}

/** Traduz erros em mensagens acionáveis. */
function describe(error) {
  if (error?.name === 'TimeoutError') {
    return 'O Google Drive demorou demais para responder. Verifique a conexão e tente novamente.';
  }
  if (/Failed to fetch|NetworkError/i.test(error?.message || '')) {
    return 'Não foi possível falar com o Google Drive. Verifique a conexão.';
  }
  return error?.message || String(error);
}

async function describeHttpError(response) {
  if (response.status === 403) {
    return 'O Google recusou a requisição (403). Confira se a API key está restrita ao domínio correto e se a Drive API está ativa.';
  }
  if (response.status === 404) {
    return 'A pasta da biblioteca não foi encontrada. Confira driveRootFolderId em js/core/config.js.';
  }
  return `Falha ao ler o Drive (${response.status}).`;
}

/** Nome canônico do pacote, reexportado para a interface. */
export { PACKAGE_FILE_NAME };

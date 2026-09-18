/**
 * KyriosStems - js/services/publish-service.js
 * Orquestra a publicação de uma sessão: grava a música, envia os arquivos e
 * registra a sessão.
 *
 * A ordem importa. O id da sessão é gerado antes do envio porque ele compõe o
 * nome da pasta no Drive, mas o registro da sessão só é gravado depois que os
 * arquivos chegam. Assim, uma falha de envio não deixa uma sessão vazia na
 * biblioteca — o pior caso é uma música ainda sem sessões, que o usuário pode
 * completar depois.
 *
 * O envio tem duas etapas: o backend cria as pastas e assina as URLs, e o
 * navegador envia os bytes direto para o Drive. Os arquivos não passam pela API.
 */

import {
  createSong as createSongRecord,
  updateSong as updateSongRecord,
  createSession as createSessionRecord,
  deleteSong as deleteSongRecord,
  deleteSession as deleteSessionRecord,
  fetchNextVersion,
} from '../repositories/library-repository.js';
import { prepareUpload, uploadFiles, categorize } from '../repositories/file-repository.js';
import * as Song from '../models/song.js';
import * as DawSession from '../models/daw-session.js';
import { PACKAGE_FILE_NAME } from '../core/constants.js';
import { formatBytes } from '../core/format.js';

/**
 * Separa os arquivos escolhidos por papel no pacote.
 *
 * O ZIP é o pacote principal. Os demais entram por extensão: projeto da DAW,
 * áudio e auxiliares. É essa separação que define a pasta de cada arquivo e,
 * portanto, a estrutura que a DAW encontrará ao abrir o pacote.
 */
export function classifyFiles(files) {
  const list = Array.from(files);
  const packages = list.filter((file) => categorize(file.name) === 'package');
  const others = list.filter((file) => categorize(file.name) !== 'package');

  /** ZIP principal; se houver mais de um, o maior costuma ser o pacote. */
  const mainPackage = packages.length
    ? packages.reduce((biggest, file) => (file.size > biggest.size ? file : biggest))
    : null;

  return {
    package: mainPackage,
    /** ZIPs excedentes ficam junto aos auxiliares. */
    extraPackages: packages.filter((file) => file !== mainPackage),
    project: others.filter((file) => categorize(file.name) === 'project'),
    audio: others.filter((file) => categorize(file.name) === 'audio'),
    aux: others.filter((file) => categorize(file.name) === 'aux'),
  };
}

/**
 * Publica uma sessão.
 *
 * @param {object} params
 * @param {object} params.song Música já validada (id próprio)
 * @param {boolean} params.isNewSong
 * @param {object} params.session Sessão já validada (id próprio)
 * @param {FileList|File[]} params.files
 * @param {(percent: number, fileName?: string) => void} [params.onProgress]
 * @param {(fileName: string, status: string, detail?: unknown) => void} [params.onFileStatus]
 * @returns {Promise<{song: object, session: object, uploaded: object[]}>}
 */
export async function publishSession({
  song,
  isNewSong,
  session,
  files,
  onProgress,
  onFileStatus,
}) {
  const songError = Song.validate(song);
  if (!songError.valid) throw new ValidationError(songError.errors);

  const sessionError = DawSession.validate(session);
  if (!sessionError.valid) throw new ValidationError(sessionError.errors);

  const groups = classifyFiles(files);
  const entries = buildUploadEntries(groups);

  if (!entries.length) {
    throw new Error('Selecione ao menos um arquivo: o ZIP da sessão ou os arquivos que a compõem.');
  }

  // 1. A música precisa existir antes da sessão (a sessão referencia songId) e
  //    antes dos arquivos (a pasta no Drive é criada a partir dela).
  const savedSong = isNewSong
    ? await createSongRecord(song)
    : await updateSongRecord(song.id, Song.toDocument(song));

  // 2. O backend cria a pasta e assina uma URL de envio por arquivo.
  const uploads = await prepareUpload({
    songId: song.id,
    sessionId: session.id,
    entries,
  });

  // 3. O navegador envia os bytes direto para o Drive. Se falhar, a sessão
  //    ainda não existe na biblioteca.
  const uploaded = await uploadFiles({ uploads, onProgress, onFileStatus });

  // 4. Registra a sessão apontando para o que foi enviado.
  const packageEntry = uploaded.find((file) => file.category === 'package');
  const savedSession = await createSessionRecord(
    {
      ...session,
      songId: song.id,
      packageFileId: packageEntry ? packageEntry.fileId : '',
      packageSize: packageEntry ? packageEntry.size : null,
    },
    uploaded.map(toSessionFile),
  );

  return { song: savedSong, session: savedSession, uploaded };
}

/**
 * Adiciona uma nova versão de sessão a uma música existente.
 * A versão é calculada pelo servidor, a partir das sessões já registradas para
 * a mesma DAW.
 */
export async function publishVersion({ song, daw, session, files, onProgress, onFileStatus }) {
  const version = await fetchNextVersion(song.id, daw);

  return publishSession({
    song,
    isNewSong: false,
    session: { ...session, version },
    files,
    onProgress,
    onFileStatus,
  });
}

/** Remove uma sessão e os arquivos dela no Drive. */
export function removeSession(songId, sessionId) {
  return deleteSessionRecord(sessionId);
}

/** Remove uma música, suas sessões e todos os arquivos. */
export function removeSong(songId) {
  return deleteSongRecord(songId);
}

/** Resumo legível do que será enviado, usado na etapa de publicação. */
export function describeUpload(groups) {
  const rows = [
    ['Pacote (ZIP)', groups.package ? 1 : 0],
    ['Projeto da DAW', groups.project.length],
    ['Áudio', groups.audio.length],
    ['Auxiliares', groups.aux.length + groups.extraPackages.length],
  ].filter(([, count]) => count > 0);

  const totalBytes = [
    groups.package,
    ...groups.extraPackages,
    ...groups.project,
    ...groups.audio,
    ...groups.aux,
  ]
    .filter(Boolean)
    .reduce((sum, file) => sum + file.size, 0);

  return { rows, totalBytes, totalLabel: formatBytes(totalBytes) };
}

/** Erro de validação com os campos rejeitados. */
export class ValidationError extends Error {
  constructor(errors) {
    super('Há campos inválidos no formulário.');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Monta a lista de envio com a categoria e o caminho relativo de cada arquivo.
 * O caminho relativo é o que o usuário verá na página da música, e espelha a
 * estrutura interna do pacote.
 */
function buildUploadEntries(groups) {
  const entries = [];

  if (groups.package) {
    entries.push({
      file: groups.package,
      category: 'package',
      relativePath: PACKAGE_FILE_NAME,
      fileName: PACKAGE_FILE_NAME,
    });
  }

  for (const file of groups.project) {
    entries.push({
      file,
      category: 'project',
      relativePath: `Project/${file.name}`,
    });
  }

  for (const file of groups.audio) {
    entries.push({
      file,
      category: 'audio',
      relativePath: `Audio/${file.name}`,
    });
  }

  for (const file of [...groups.aux, ...groups.extraPackages]) {
    entries.push({
      file,
      category: 'aux',
      relativePath: file.name,
    });
  }

  return entries;
}

/** Converte o resultado do envio no formato de arquivo da sessão. */
function toSessionFile(file) {
  return {
    name: file.name,
    path: file.path,
    fileId: file.fileId,
    size: file.size,
    category: file.category,
    contentType: file.contentType,
  };
}
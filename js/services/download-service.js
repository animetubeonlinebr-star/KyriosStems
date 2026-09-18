/**
 * KyriosStems - js/services/download-service.js
 * Resolução e disparo do download de pacotes e arquivos individuais.
 *
 * O download completo é o fluxo principal. Os arquivos individuais são um
 * extra opcional.
 */

import {
  resolvePackageUrl,
  triggerDownload,
  listSessionFiles,
  categorize,
} from '../repositories/file-repository.js';
import { isSignedIn } from '../api/auth.js';
import { packageFileName } from '../models/daw-session.js';
import { formatBytes } from '../core/format.js';
import { UPLOAD_LIMITS } from '../core/constants.js';

/**
 * @typedef {Object} DownloadTarget
 * @property {string} url
 * @property {string} fileName
 * @property {number|null} size
 */

/**
 * Prepara o download do pacote principal de uma sessão.
 * @param {import('../models/song.js').Song} song
 * @param {import('../models/daw-session.js').DawSession} session
 * @returns {Promise<DownloadTarget>}
 */
export async function preparePackageDownload(song, session) {
  if (!session.packageFileId) {
    throw new Error('Esta sessão ainda não possui pacote enviado.');
  }

  const resolved = await resolvePackageUrl(session, packageFileName(song, session));
  if (!resolved) throw new Error('Não foi possível localizar o pacote.');

  return { url: resolved.url, fileName: resolved.fileName, size: session.packageSize ?? null };
}

/**
 * Prepara o download de um arquivo individual da sessão.
 *
 * Os arquivos individuais são resolvidos pela API, que devolve a URL de cada um
 * junto com o nome amigável.
 *
 * @returns {Promise<DownloadTarget>}
 */
export async function prepareFileDownload(session, file) {
  if (!session?.id) throw new Error('Sessão inválida.');
  if (!file?.name) throw new Error('Arquivo sem nome.');

  const files = await listSessionFiles(session.id);
  const match = files.find((entry) => entry.name === file.name);

  if (!match?.url) throw new Error('Arquivo não encontrado no armazenamento.');

  return { url: match.url, fileName: match.name, size: match.size ?? null };
}

/** Executa o download, sinalizando pacotes grandes. */
export function startDownload(target) {
  triggerDownload(target.url, target.fileName);
  return target;
}

/** Texto de aviso para pacotes grandes. */
export function largePackageWarning(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value < UPLOAD_LIMITS.largePackageBytes) return null;
  return `Este pacote tem ${formatBytes(value)}. O download pode demorar.`;
}

/** Indica se há sessão administrativa ativa (usada para avisos de interface). */
export function hasAdminSession() {
  return isSignedIn();
}

/**
 * Nome de arquivo seguro derivado de uma sessão.
 * Exposto para reutilização em testes e na interface administrativa.
 */
export { packageFileName, categorize };
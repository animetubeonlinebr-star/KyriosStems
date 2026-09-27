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
  downloadUrlFor,
  categorize,
  isDriveConfigured,
} from '../repositories/drive-repository.js';
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
 *
 * O download não exige autorização: o arquivo é compartilhado por link, e é
 * isso que permite o catálogo público continuar funcionando sem backend.
 *
 * @param {import('../models/song.js').Song} song
 * @param {import('../models/daw-session.js').DawSession} session
 * @returns {Promise<DownloadTarget>}
 */
export async function preparePackageDownload(song, session) {
  if (!isDriveConfigured()) {
    throw new Error(
      'O acesso ao Drive ainda não foi configurado. Defina googleClientId em js/firebase/config.js.',
    );
  }
  if (!session.packageFileId) {
    throw new Error('Esta sessão ainda não possui pacote enviado.');
  }

  const resolved = await resolvePackageUrl(session, packageFileName(song, session));
  if (!resolved) throw new Error('Não foi possível localizar o pacote no Drive.');

  return { url: resolved.url, fileName: resolved.fileName, size: session.packageSize ?? null };
}

/**
 * Prepara o download de um arquivo individual da sessão.
 * @returns {Promise<DownloadTarget>}
 */
export async function prepareFileDownload(session, file) {
  if (!isDriveConfigured()) {
    throw new Error(
      'O acesso ao Drive ainda não foi configurado. Defina googleClientId em js/firebase/config.js.',
    );
  }
  if (!file?.fileId) throw new Error('Arquivo sem identificador no Drive.');

  return { url: downloadUrlFor(file.fileId), fileName: file.name, size: file.size ?? null };
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

/**
 * Nome de arquivo seguro derivado de uma sessão.
 * Exposto para reutilização em testes e na interface administrativa.
 */
export { packageFileName, categorize };
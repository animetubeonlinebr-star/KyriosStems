/**
 * KyriosStems - js/services/download-service.js
 * Resolução e disparo do download de pacotes e arquivos individuais.
 *
 * O download completo é o fluxo principal. Os arquivos individuais são um
 * extra opcional.
 *
 * Não há autorização envolvida: a pasta da biblioteca é pública por link, então
 * qualquer visitante do catálogo consegue baixar. É o que permite a aplicação
 * funcionar inteiramente no navegador, sem servidor entregando os bytes.
 */

import { downloadUrlFor, categorize } from '../repositories/drive-repository.js';
import { isDriveConfigured } from '../core/config.js';
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
  if (!isDriveConfigured()) {
    throw new Error('A biblioteca ainda não foi conectada ao Drive. Preencha js/core/config.js.');
  }
  if (!session.packageFileId) {
    throw new Error('Esta sessão não tem pacote: coloque o ZIP na pasta dela no Drive.');
  }

  return {
    url: downloadUrlFor(session.packageFileId),
    fileName: packageFileName(song, session),
    size: session.packageSize ?? null,
  };
}

/**
 * Prepara o download de um arquivo individual da sessão.
 * @returns {Promise<DownloadTarget>}
 */
export async function prepareFileDownload(session, file) {
  if (!isDriveConfigured()) {
    throw new Error('A biblioteca ainda não foi conectada ao Drive. Preencha js/core/config.js.');
  }
  if (!file?.fileId) throw new Error('Arquivo sem identificador no Drive.');

  return { url: downloadUrlFor(file.fileId), fileName: file.name, size: file.size ?? null };
}

/**
 * Executa o download.
 *
 * O atributo `download` é ignorado entre domínios, e o arquivo vem do Drive:
 * o nome amigável nem sempre é respeitado. É limitação do navegador,
 * documentada em docs/storage.md.
 */
export function startDownload(target) {
  const anchor = document.createElement('a');
  anchor.href = target.url;
  anchor.download = target.fileName || '';
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
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
 * Exposto para reutilização na interface.
 */
export { packageFileName, categorize };

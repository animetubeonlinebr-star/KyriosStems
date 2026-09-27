/**
 * KyriosStems - js/repositories/drive-repository.js
 * Armazenamento dos arquivos de sessão no Google Drive.
 *
 * Substitui o storage-repository do Firebase Storage, mantendo o mesmo
 * contrato de retorno para que a camada de serviço e as páginas não precisem
 * conhecer o provedor.
 *
 * Estrutura no Drive, sob a pasta raiz configurada:
 *   KyriosStems/{songId}/{sessionId}/
 *     ├── session.zip
 *     ├── projeto.rpp
 *     └── 01 Drums.wav
 *
 * O catálogo é público e o download precisa funcionar para qualquer visitante,
 * que não tem autorização no Drive de ninguém. Por isso cada arquivo recebe
 * permissão de leitura por link ao ser enviado. A autorização do administrador
 * é exigida apenas para ESCREVER.
 */

import {
  ensureFolder,
  findFolder,
  listChildren,
  uploadFile as driveUpload,
  shareByLink,
  deleteFile,
  getFile,
} from '../drive/client.js';
import { isDriveConfigured } from '../drive/auth.js';
import {
  EXTENSION_CATEGORY,
  STORAGE_FOLDERS,
  PACKAGE_FILE_NAME,
  GOOGLE,
} from '../core/constants.js';
import { driveRootFolderId } from '../firebase/config.js';
import { fileExtension, sanitizeFileName } from '../core/format.js';

export { isDriveConfigured };

/** Deriva a categoria de um arquivo a partir da extensão. */
export function categorize(fileName) {
  return EXTENSION_CATEGORY[fileExtension(fileName)] || STORAGE_FOLDERS.aux;
}

/** Nome da pasta de uma sessão. */
export function sessionFolderName(sessionId) {
  return sessionId;
}

/** Categoria do pacote principal. */
export function packageCategory() {
  return STORAGE_FOLDERS.package;
}

/**
 * Resolve (criando se preciso) a pasta de uma sessão.
 * @returns {Promise<string>} id da pasta no Drive
 */
export async function ensureSessionFolder(songId, sessionId) {
  const song = await ensureFolder(songId, driveRootFolderId || null);
  return ensureFolder(sessionFolderName(sessionId), song);
}

/**
 * Envia um único arquivo para a pasta da sessão.
 *
 * @param {object} params
 * @param {string} params.songId
 * @param {string} params.sessionId
 * @param {string} params.category
 * @param {File|Blob} params.file
 * @param {string} [params.fileName]
 * @param {(percent: number) => void} [params.onProgress]
 */
export async function uploadFile({ songId, sessionId, category, file, fileName, onProgress }) {
  const folderId = await ensureSessionFolder(songId, sessionId);
  const name = sanitizeFileName(fileName || file.name || 'arquivo');

  const uploaded = await driveUpload({
    file,
    name,
    parentId: folderId,
    mimeType: file.type || 'application/octet-stream',
    onProgress,
  });

  // O visitante do catálogo não tem autorização no Drive: sem link público, o
  // download que ele vê na página falharia com 403.
  await shareByLink(uploaded.id);

  return {
    name,
    // O caminho relativo serve à apresentação; o id é o que identifica o arquivo.
    path: name,
    size: file.size,
    category,
    contentType: file.type || 'application/octet-stream',
    fileId: uploaded.id,
    url: downloadUrlFor(uploaded.id),
  };
}

/**
 * Envia vários arquivos sequencialmente, reportando progresso agregado.
 * Sequencial evita saturar a conexão e mantém a barra de progresso legível.
 *
 * @param {object} params
 * @param {Array<{file: File, category: string, relativePath?: string}>} params.entries
 */
export async function uploadFiles({ songId, sessionId, entries, onProgress, onFileStatus }) {
  const results = [];
  const total = entries.length;

  for (let index = 0; index < total; index += 1) {
    const entry = entries[index];
    const file = entry.file;

    try {
      const uploaded = await uploadFile({
        songId,
        sessionId,
        category: entry.category,
        file,
        fileName: entry.fileName,
        onProgress: (percent) => {
          if (!onProgress) return;
          onProgress(Math.round(((index + percent / 100) / total) * 100), file.name);
        },
      });

      const record = {
        ...uploaded,
        // `path` é o caminho relativo dentro do pacote, que é o que o usuário
        // reconhece na página da música.
        path: entry.relativePath || uploaded.name,
      };
      results.push(record);

      onFileStatus?.(file.name, 'uploaded', record);
    } catch (error) {
      onFileStatus?.(file.name, 'error', error);
      throw error;
    }
  }

  return results;
}

/** URL de visualização direta de um arquivo do Drive. */
export function downloadUrlFor(fileId) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

/** URL de visualização no Drive (quando o download direto não serve). */
export function viewUrlFor(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

/**
 * Resolve a URL do pacote principal de uma sessão.
 * @returns {Promise<{url: string, fileName: string}|null>}
 */
export async function resolvePackageUrl(session, fileName) {
  const fileId = session?.packageFileId || findFileId(session?.files, PACKAGE_FILE_NAME);
  if (!fileId) return null;

  return { url: downloadUrlFor(fileId), fileName: fileName || PACKAGE_FILE_NAME };
}

/** Procura o id de um arquivo pelo caminho relativo na lista da sessão. */
function findFileId(files, relativePath) {
  const match = (files ?? []).find((file) => file.path === relativePath);
  return match?.fileId ?? null;
}

/**
 * Dispara o download.
 *
 * O atributo `download` é ignorado entre domínios (o arquivo vem do Drive), e
 * por isso o nome amigável nem sempre é respeitado — limitação conhecida,
 * documentada em docs/storage.md.
 */
export function triggerDownload(url, fileName) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || '';
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/** Remove todos os arquivos de uma sessão. */
export async function deleteSessionFiles(songId, sessionId) {
  const song = await findFolderByName(songId, driveRootFolderId || null);
  if (!song) return;

  const session = await findFolderByName(sessionId, song);
  if (!session) return;

  await deleteFolderContents(session);
}

/** Remove todos os arquivos de uma música (todas as sessões). */
export async function deleteSongFiles(songId) {
  const song = await findFolderByName(songId, driveRootFolderId || null);
  if (!song) return;

  const sessions = await listChildren(song);
  for (const session of sessions) {
    if (session.mimeType === GOOGLE.folderMimeType) await deleteFolderContents(session.id);
  }
}

async function findFolderByName(name, parentId) {
  const folder = await findFolder(name, parentId);
  return folder?.id ?? null;
}

/** Apaga recursivamente o conteúdo de uma pasta. */
async function deleteFolderContents(folderId) {
  const children = await listChildren(folderId);

  for (const child of children) {
    if (child.mimeType === GOOGLE.folderMimeType) {
      await deleteFolderContents(child.id);
    } else {
      await deleteFile(child.id);
    }
  }
}

/** Confirma que o arquivo existe e é acessível. */
export function fileInfo(fileId) {
  return getFile(fileId);
}

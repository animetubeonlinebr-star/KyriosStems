/**
 * KyriosStems - js/repositories/storage-repository.js
 * Armazenamento dos arquivos de sessão no Firebase Storage.
 *
 * Estrutura:
 *   sessions/{songId}/{sessionId}/package/session.zip
 *   sessions/{songId}/{sessionId}/project/projeto.rpp
 *   sessions/{songId}/{sessionId}/audio/01 Drums.wav
 *   sessions/{songId}/{sessionId}/aux/README.txt
 */

import { initFirebase } from '../firebase/app.js';
import {
  EXTENSION_CATEGORY,
  STORAGE_FOLDERS,
  PACKAGE_FILE_NAME,
} from '../core/constants.js';
import { fileExtension, sanitizeFileName } from '../core/format.js';

/** Deriva a categoria de um arquivo a partir da extensão. */
export function categorize(fileName) {
  return EXTENSION_CATEGORY[fileExtension(fileName)] || STORAGE_FOLDERS.aux;
}

/**
 * Caminho de um arquivo no Storage. Fonte única da estrutura de pastas:
 *   sessions/{songId}/{sessionId}/{categoria}/{arquivo}
 */
export function sessionPath(songId, sessionId, category, fileName) {
  return `sessions/${songId}/${sessionId}/${category}/${fileName}`;
}

/** Caminho do pacote principal de uma sessão. */
export function packagePath(songId, sessionId) {
  return sessionPath(songId, sessionId, STORAGE_FOLDERS.package, PACKAGE_FILE_NAME);
}

/**
 * Envia um único arquivo.
 * @param {object} params
 * @param {string} params.songId
 * @param {string} params.sessionId
 * @param {string} params.category
 * @param {File|Blob} params.file
 * @param {string} [params.fileName] Nome de destino, quando difere do original
 * @param {(percent: number) => void} [params.onProgress]
 */
export async function uploadFile({ songId, sessionId, category, file, fileName, onProgress }) {
  const { storage, sdk } = await initFirebase();

  const name = sanitizeFileName(fileName || file.name || 'arquivo');
  const path = sessionPath(songId, sessionId, category, name);
  const ref = sdk.storageModule.ref(storage, path);

  const task = sdk.storageModule.uploadBytesResumable(ref, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: 'private, max-age=0',
  });

  await new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (!onProgress || !snapshot.totalBytes) return;
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      resolve,
    );
  });

  const url = await sdk.storageModule.getDownloadURL(ref);
  return {
    name,
    path,
    size: file.size,
    category,
    contentType: file.type || 'application/octet-stream',
    url,
  };
}

/**
 * Envia vários arquivos sequencialmente, reportando progresso agregado.
 * Sequencial evita saturar a conexão e mantém a barra de progresso legível.
 *
 * @param {object} params
 * @param {Array<{file: File, category: string, path?: string}>} params.entries
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

      // `storagePath` é o caminho real no Storage; `path` é o caminho relativo
      // dentro do pacote, que é o que o usuário reconhece na página da música.
      const record = {
        ...uploaded,
        storagePath: uploaded.path,
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

/** Obtém a URL de download de um caminho no Storage. */
export async function downloadUrl(path) {
  const { storage, sdk } = await initFirebase();
  return sdk.storageModule.getDownloadURL(sdk.storageModule.ref(storage, path));
}

/**
 * Resolve a URL do pacote principal de uma sessão.
 * @returns {Promise<{url: string, fileName: string}|null>}
 */
export async function resolvePackageUrl(session, fileName) {
  if (!session?.packagePath) return null;
  const url = await downloadUrl(session.packagePath);
  return { url, fileName: fileName || 'session.zip' };
}

/**
 * Dispara o download usando a URL do Storage.
 * Um elemento <a download> preserva o nome do arquivo sugerido.
 */
export function triggerDownload(url, fileName) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName || '';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/** Remove todos os arquivos de uma sessão. */
export async function deleteSessionFiles(songId, sessionId) {
  const { storage, sdk } = await initFirebase();
  const folder = sdk.storageModule.ref(storage, `sessions/${songId}/${sessionId}`);
  await deleteRecursive(sdk, storage, folder);
}

/** Remove todos os arquivos de uma música (todas as sessões). */
export async function deleteSongFiles(songId) {
  const { storage, sdk } = await initFirebase();
  const folder = sdk.storageModule.ref(storage, `sessions/${songId}`);
  const listing = await sdk.storageModule.listAll(folder);

  await Promise.all(listing.prefixes.map((prefix) => deleteRecursive(sdk, storage, prefix)));
}

async function deleteRecursive(sdk, storage, prefix) {
  const listing = await sdk.storageModule.listAll(prefix);
  await Promise.all([
    ...listing.items.map((item) => sdk.storageModule.deleteObject(item)),
    ...listing.prefixes.map((child) => deleteRecursive(sdk, storage, child)),
  ]);
}
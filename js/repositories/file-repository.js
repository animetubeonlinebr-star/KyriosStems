/**
 * KyriosStems - js/repositories/file-repository.js
 * Envio e download dos arquivos de sessão, via Google Drive.
 *
 * Substitui storage-repository.js. A diferença central: os bytes NÃO passam
 * pela API. O backend cria as pastas e assina uma URL de envio retomável; o
 * navegador envia o arquivo direto para o Google Drive. Um pacote de sessão
 * pode ter gigabytes, e atravessar a API somaria latência e esbarraria no
 * limite de corpo da requisição.
 *
 * Estrutura no Drive:
 *   {pasta raiz}/
 *     └── session_{sessionId}/
 *         ├── session.zip
 *         ├── projeto.rpp
 *         ├── 01 Drums.wav
 *         └── README.txt
 */

import { get, post, ApiError } from '../api/client.js';
import { apiUrl } from '../core/config.js';
import {
  EXTENSION_CATEGORY,
  STORAGE_FOLDERS,
  PACKAGE_FILE_NAME,
  NETWORK,
} from '../core/constants.js';
import { fileExtension, sanitizeFileName } from '../core/format.js';

/** Deriva a categoria de um arquivo a partir da extensão. */
export function categorize(fileName) {
  return EXTENSION_CATEGORY[fileExtension(fileName)] || STORAGE_FOLDERS.aux;
}

/**
 * Prepara o envio: o backend cria a pasta da sessão e devolve uma URL de envio
 * retomável por arquivo.
 *
 * @param {object} params
 * @param {string} params.songId
 * @param {string} params.sessionId
 * @param {Array<{file: File, category: string, relativePath?: string, fileName?: string}>} params.entries
 * @returns {Promise<Array<object>>} entradas de envio, na mesma ordem
 */
export async function prepareUpload({ songId, sessionId, entries }) {
  const payload = entries.map((entry) => ({
    name: sanitizeFileName(entry.fileName || entry.file.name || 'arquivo'),
    category: entry.category,
    path: entry.relativePath || entry.fileName || entry.file.name,
    size: entry.file.size,
    contentType: entry.file.type || 'application/octet-stream',
  }));

  const data = await post('/api/drive/prepare', { songId, sessionId, files: payload }, { auth: true });

  // O backend devolve as URLs na mesma ordem em que recebeu os arquivos.
  return data.uploads.map((upload, index) => ({ ...upload, file: entries[index].file }));
}

/**
 * Envia um arquivo para a URL assinada pelo backend.
 *
 * Usa XHR em vez de fetch porque só o XHR informa progresso de envio. Sem isso
 * a barra ficaria parada durante todo o upload de um pacote grande, que é
 * justamente quando o usuário mais precisa de retorno.
 *
 * @returns {Promise<{fileId: string, size: number}>}
 */
export function uploadToDrive(upload, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', upload.file.type || 'application/octet-stream');
    xhr.timeout = NETWORK.uploadTimeoutMs;

    xhr.upload.addEventListener('progress', (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(
          `O Google Drive recusou o envio de "${upload.name}" (${xhr.status}).`,
          xhr.status,
          null,
        ));
        return;
      }

      let fileId = null;
      try {
        fileId = JSON.parse(xhr.responseText)?.id ?? null;
      } catch {
        fileId = null;
      }

      if (!fileId) {
        reject(new ApiError(`O Google Drive não devolveu o id de "${upload.name}".`, 502, null));
        return;
      }

      resolve({ fileId, size: upload.file.size });
    });

    xhr.addEventListener('error', () => {
      reject(new ApiError(`Falha de rede ao enviar "${upload.name}".`, 0, null));
    });

    xhr.addEventListener('timeout', () => {
      reject(new ApiError(`O envio de "${upload.name}" demorou demais e foi interrompido.`, 0, null));
    });

    xhr.send(upload.file);
  });
}

/**
 * Envia vários arquivos sequencialmente, reportando progresso agregado.
 *
 * Sequencial, não paralelo: em paralelo a conexão do usuário satura e a barra
 * de progresso deixa de ser coerente com o que está acontecendo.
 *
 * @param {object} params
 * @param {Array<object>} params.uploads Saída de `prepareUpload`
 * @returns {Promise<Array<object>>} registros no formato aceito pela API
 */
export async function uploadFiles({ uploads, onProgress, onFileStatus }) {
  const results = [];
  const total = uploads.length;

  for (let index = 0; index < total; index += 1) {
    const upload = uploads[index];

    try {
      const sent = await uploadToDrive(upload, (percent) => {
        if (!onProgress) return;
        onProgress(Math.round(((index + percent / 100) / total) * 100), upload.name);
      });

      // `fileId` é o identificador do arquivo no Drive; `path` é o caminho
      // relativo dentro do pacote, que é o que o usuário reconhece na página
      // da música.
      const record = {
        name: upload.name,
        path: upload.path,
        fileId: sent.fileId,
        size: sent.size,
        category: upload.category,
        contentType: upload.file.type || 'application/octet-stream',
      };

      results.push(record);
      onFileStatus?.(upload.name, 'uploaded', record);
    } catch (error) {
      onFileStatus?.(upload.name, 'error', error);
      throw error;
    }
  }

  return results;
}

/* -------------------------------------------------------------------------- */
/* Download                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a URL do pacote principal de uma sessão.
 *
 * A URL aponta para o backend, não para o Drive: a pasta é privada e o backend
 * entrega os bytes. O nome amigável é resolvido no servidor, o que faz o
 * navegador salvar o arquivo com o título da música — algo que o atributo
 * `download` não conseguia garantir quando as URLs vinham de outro domínio.
 *
 * @returns {Promise<{url: string, fileName: string, size: number|null}|null>}
 */
export async function resolvePackageUrl(session, fileName) {
  if (!session?.packageFileId) return null;

  const data = await get(`/api/drive/sessions/${encodeURIComponent(session.id)}/package`);
  return {
    url: apiUrl(data.url),
    fileName: fileName || data.fileName,
    size: data.size ?? null,
  };
}

/** Arquivos individuais de uma sessão, com URL de download. */
export async function listSessionFiles(sessionId) {
  const data = await get(`/api/drive/sessions/${encodeURIComponent(sessionId)}/files`);
  return (data.files ?? []).map((file) => ({ ...file, url: apiUrl(file.url) }));
}

/**
 * Dispara o download.
 *
 * O nome amigável é passado por parâmetro na URL e aplicado pelo backend no
 * Content-Disposition. O atributo `download` é mantido como reforço, para o
 * caso de o navegador respeitá-lo.
 */
export function triggerDownload(url, fileName) {
  const separator = url.includes('?') ? '&' : '?';
  const href = fileName ? `${url}${separator}name=${encodeURIComponent(fileName)}` : url;

  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName || '';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export { PACKAGE_FILE_NAME };
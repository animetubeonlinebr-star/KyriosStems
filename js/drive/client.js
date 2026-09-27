/**
 * KyriosStems - js/drive/client.js
 * Chamadas diretas à API do Google Drive.
 *
 * Conduz o envio pelo método resumível: inicia a sessão, envia os bytes e, se a
 * conexão cair, retoma de onde parou. Um pacote de sessão tem gigabytes — repetir
 * o envio inteiro a cada oscilação de rede seria inviável.
 *
 * Usa XMLHttpRequest (e não fetch) porque só ele reporta progresso de envio no
 * navegador, e a barra de progresso do painel depende disso.
 */

import { GOOGLE } from '../core/constants.js';
import { driveToken, requireDriveToken, forgetDriveToken } from './auth.js';

/** Cabeçalho de autorização da requisição atual. */
async function authHeader() {
  const token = await requireDriveToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * Executa uma chamada JSON à API do Drive.
 * Renova a autorização uma vez quando o servidor responde 401, porque o token
 * pode ter expirado entre a verificação local e a chamada.
 */
export async function driveFetch(path, { method = 'GET', body, headers = {}, retried = false } = {}) {
  const response = await fetch(`${GOOGLE.apiBase}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeader()),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !retried) {
    forgetDriveToken();
    return driveFetch(path, { method, body, headers, retried: true });
  }

  if (!response.ok) {
    throw new Error(await describeDriveError(response));
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Traduz a resposta de erro do Drive em mensagem acionável. */
async function describeDriveError(response) {
  let detail = '';
  try {
    const data = await response.json();
    detail = data?.error?.message || '';
  } catch {
    // corpo não-JSON: mantém a mensagem genérica
  }

  if (response.status === 401) {
    return `A autorização do Google expirou. Autorize novamente. ${detail}`.trim();
  }
  if (response.status === 403) {
    return `O Google recusou o acesso (403). Verifique se o escopo drive.file foi autorizado. ${detail}`.trim();
  }
  if (response.status === 404) {
    return 'O arquivo não existe mais no Drive (404).';
  }
  return `Falha na API do Drive (${response.status}). ${detail}`.trim();
}

/** Cria uma pasta e devolve seu id. */
export async function createFolder(name, parentId = null) {
  const data = await driveFetch('/files?fields=id', {
    method: 'POST',
    body: {
      name,
      mimeType: GOOGLE.folderMimeType,
      ...(parentId ? { parents: [parentId] } : {}),
    },
  });
  return data.id;
}

/** Obtém os metadados de um arquivo ou pasta. */
export function getFile(fileId) {
  return driveFetch(`/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,shortcutDetails`);
}

/** Lista os filhos de uma pasta. */
export async function listChildren(folderId) {
  const data = await driveFetch(
    `/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}` +
      '&fields=files(id,name,mimeType,size)&pageSize=1000',
  );
  return data?.files ?? [];
}

/** Encontra uma pasta pelo nome dentro de um pai, ou null. */
export async function findFolder(name, parentId = null) {
  const query = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${GOOGLE.folderMimeType}'`,
    parentId ? `'${parentId}' in parents` : "'root' in parents",
  ].join(' and ');

  const data = await driveFetch(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
  );
  return data?.files?.[0] ?? null;
}

/** Devolve a pasta existente com esse nome, ou cria uma. */
export async function ensureFolder(name, parentId = null) {
  const existing = await findFolder(name, parentId);
  return existing?.id ?? createFolder(name, parentId);
}

/** Torna um arquivo legível por link, para que o catálogo público possa baixá-lo. */
export async function shareByLink(fileId) {
  await driveFetch(`/files/${encodeURIComponent(fileId)}/permissions`, {
    method: 'POST',
    body: { role: 'reader', type: 'anyone' },
  });
}

/** Remove um arquivo. */
export function deleteFile(fileId) {
  return driveFetch(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

/** Move um arquivo para a lixeira do Drive. */
export function trashFile(fileId) {
  return driveFetch(`/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    body: { trashed: true },
  });
}

/**
 * Envia um arquivo pelo método resumível, reportando progresso.
 *
 * @param {object} params
 * @param {File|Blob} params.file
 * @param {string} params.name Nome do arquivo no Drive
 * @param {string} [params.parentId] Pasta de destino
 * @param {string} [params.mimeType]
 * @param {(percent: number) => void} [params.onProgress]
 * @returns {Promise<{id: string, name: string, size: number}>}
 */
export async function uploadFile({ file, name, parentId = null, mimeType, onProgress }) {
  const sessionUri = await startResumableSession({ file, name, parentId, mimeType });
  const result = await sendToSession(sessionUri, file, onProgress);
  return { id: result.id, name: result.name, size: file.size };
}

/** Abre a sessão de envio resumível e devolve a URI. */
async function startResumableSession({ file, name, parentId, mimeType }) {
  const metadata = {
    name,
    ...(parentId ? { parents: [parentId] } : {}),
  };

  const response = await fetch(
    `${GOOGLE.uploadBase}/files?uploadType=resumable&fields=id,name`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await requireDriveToken()}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!response.ok) {
    throw new Error(await describeDriveError(response));
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new Error('O Google não devolveu a URL de envio. Verifique se o escopo drive.file foi autorizado.');
  }
  return location;
}

/**
 * Envia os bytes para a sessão, retomando de onde parou se a conexão cair.
 *
 * Protocolo do envio resumível: um PUT com os bytes responde 200/201 ao
 * concluir, ou 308 enquanto o envio está incompleto. Depois de uma queda,
 * pergunta-se ao Google quantos bytes ele já recebeu (PUT com `Content-Range:
 * bytes */total`) e continua-se daí — em vez de reenviar tudo.
 */
function sendToSession(sessionUri, file, onProgress) {
  const total = file.size;

  /** Um PUT cujo corpo é o restante do arquivo. */
  const sendFrom = (offset) =>
    new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', sessionUri, true);
      request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      request.setRequestHeader('Content-Range', `bytes ${offset}-${total - 1}/${total}`);

      request.upload.addEventListener('progress', (event) => {
        if (!onProgress || !total) return;
        onProgress(Math.min(99, Math.round(((offset + event.loaded) / total) * 100)));
      });

      request.addEventListener('load', () => {
        if (request.status === 200 || request.status === 201) {
          onProgress?.(100);
          resolve({ done: true, body: safeJson(request.responseText) });
          return;
        }
        if (request.status === 308) {
          // Incompleto: o cabeçalho Range diz até onde o Google recebeu.
          resolve({ done: false, offset: parseRangeEnd(request.getResponseHeader('Range'), offset) });
          return;
        }
        reject(new Error(`Falha ao enviar para o Drive (${request.status}).`));
      });

      request.addEventListener('error', () => reject(new Error('network')));
      request.addEventListener('abort', () => reject(new Error('O envio ao Drive foi cancelado.')));

      request.send(file.slice(offset));
    });

  /** Descobre quantos bytes o Google já tem, após uma queda. */
  const askProgress = () =>
    new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', sessionUri, true);
      request.setRequestHeader('Content-Range', `bytes */${total}`);
      request.addEventListener('load', () => {
        if (request.status === 308) {
          resolve(parseRangeEnd(request.getResponseHeader('Range'), 0));
          return;
        }
        if (request.status === 200 || request.status === 201) {
          resolve(total);
          return;
        }
        reject(new Error(`Falha ao consultar o envio (${request.status}).`));
      });
      request.addEventListener('error', () => reject(new Error('network')));
      request.send();
    });

  return (async () => {
    let offset = 0;
    let attempts = 0;

    while (attempts < 4) {
      try {
        const result = await sendFrom(offset);
        if (result.done) return result.body;
        offset = result.offset;
      } catch (error) {
        attempts += 1;
        if (error.message !== 'network' || attempts >= 4) throw error;
        // Pergunta o que chegou antes de continuar, para não reenviar bytes.
        offset = await askProgress();
        if (offset >= total) return null;
      }
    }

    throw new Error('O envio ao Drive não foi concluído após várias tentativas.');
  })();
}

/** Último byte recebido, segundo o cabeçalho `Range: bytes=0-N`. */
function parseRangeEnd(header, fallback) {
  if (!header) return fallback;
  const match = /bytes=\d+-(\d+)/.exec(header);
  return match ? Number(match[1]) + 1 : fallback;
}

function safeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

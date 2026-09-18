/**
 * KyriosStems - backend/src/drive/client.js
 * Cliente do Google Drive.
 *
 * A biblioteca é privada, então todo acesso passa pelo backend. A identidade é
 * uma conta Google dedicada ao KyriosStems: o backend guarda o refresh token e
 * troca por um access token de curta duração, renovado sozinho.
 *
 * Usa a API REST direto, sem o pacote `googleapis`. São poucas operações e o
 * pacote traria dezenas de megabytes de clientes gerados que não usamos.
 */

import { drive } from '../config.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Access token em cache, com a expiração, para não pedir um a cada chamada. */
let cachedToken = null;

/** Troca o refresh token por um access token. */
async function accessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    client_id: drive.clientId,
    client_secret: drive.clientSecret,
    refresh_token: drive.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // `invalid_grant` é o caso comum: refresh token revogado ou de outra conta.
    // A mensagem precisa dizer isso, porque o erro cru do Google não é claro.
    const detail = data.error === 'invalid_grant'
      ? 'O refresh token do Google Drive foi revogado ou não pertence a este client_id. Gere um novo.'
      : data.error_description || data.error || response.statusText;
    throw new DriveError(`Falha ao autenticar no Google Drive: ${detail}`, response.status);
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600) * 1000,
  };

  return cachedToken.value;
}

/** Erro do Drive, com o status HTTP preservado para a camada de rotas. */
export class DriveError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'DriveError';
    this.status = status;
  }
}

/** Chamada autenticada à API. */
async function apiFetch(url, options = {}) {
  const token = await accessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    // Token expirado antes do previsto: descarta o cache e tenta uma vez mais.
    cachedToken = null;
    const retryToken = await accessToken();
    return fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${retryToken}`, ...(options.headers || {}) },
    });
  }

  return response;
}

/** Lê o corpo JSON, traduzindo erro em DriveError. */
async function readJson(response, context) {
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new DriveError(`${context}: ${message}`, response.status);
  }

  return data;
}

/** Cria uma pasta e devolve o id. */
export async function createFolder(name, parentId) {
  const response = await apiFetch(`${API}/files?fields=id,name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    }),
  });

  const data = await readJson(response, 'Criar pasta no Drive');
  return data.id;
}

/**
 * Procura uma pasta pelo nome dentro de um pai; cria se não existir.
 *
 * O Drive permite nomes repetidos, então sem esta busca cada publicação criaria
 * uma pasta nova com o mesmo nome. A busca restringe a pastas, ao pai e a itens
 * não enviados para a lixeira.
 */
export async function ensureFolder(name, parentId) {
  const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = [
    `name = '${escaped}'`,
    `mimeType = '${FOLDER_MIME}'`,
    `'${parentId}' in parents`,
    'trashed = false',
  ].join(' and ');

  const url = `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const response = await apiFetch(url);
  const data = await readJson(response, 'Procurar pasta no Drive');

  if (data.files?.length) return data.files[0].id;
  return createFolder(name, parentId);
}

/** Metadados de um arquivo. */
export async function getFile(fileId) {
  const response = await apiFetch(
    `${API}/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType,parents`,
  );
  return readJson(response, 'Ler arquivo do Drive');
}

/**
 * Inicia um envio retomável e devolve a URL para onde o navegador envia os
 * bytes.
 *
 * O envio não passa pelo backend: um pacote de sessão pode ter gigabytes, e
 * fazê-lo atravessar a API somaria latência e esbarraria no limite de corpo da
 * requisição. O backend só assina a autorização e registra o resultado.
 */
export async function createResumableUpload({ name, parentId, contentType, size }) {
  const token = await accessToken();

  const response = await fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id,name,size`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': contentType || 'application/octet-stream',
      ...(size ? { 'X-Upload-Content-Length': String(size) } : {}),
    },
    body: JSON.stringify({ name, parents: parentId ? [parentId] : undefined }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new DriveError(
      `Não foi possível iniciar o envio: ${data?.error?.message || response.statusText}`,
      response.status,
    );
  }

  const location = response.headers.get('location');
  if (!location) throw new DriveError('O Drive não devolveu a URL de envio.', 502);

  return location;
}

/** Baixa o conteúdo de um arquivo, devolvendo o corpo como stream. */
export async function downloadFile(fileId, rangeHeader) {
  const response = await apiFetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: rangeHeader ? { Range: rangeHeader } : {},
  });

  if (!response.ok && response.status !== 206) {
    const data = await response.json().catch(() => null);
    throw new DriveError(
      `Não foi possível baixar o arquivo: ${data?.error?.message || response.statusText}`,
      response.status,
    );
  }

  return response;
}

/** Move um arquivo para a lixeira. */
export async function trashFile(fileId) {
  const response = await apiFetch(`${API}/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });

  if (response.status === 404) return false;
  await readJson(response, 'Remover arquivo do Drive');
  return true;
}

/** Verifica se a configuração do Drive realmente funciona. */
export async function ping() {
  const response = await apiFetch(
    `${API}/files/${encodeURIComponent(drive.rootFolderId)}?fields=id,name,mimeType`,
  );
  const data = await readJson(response, 'Ler a pasta raiz do Drive');
  return { id: data.id, name: data.name, mimeType: data.mimeType };
}

export { FOLDER_MIME };
/**
 * KyriosStems - js/api/client.js
 * Cliente HTTP da API.
 *
 * Toda operação de rede passa por aqui, o que mantém em um único lugar o
 * endereço, o token, o limite de tempo e a tradução de erro.
 *
 * O token de sessão vive em localStorage. Não é o ideal em teoria (um XSS
 * poderia lê-lo), mas a alternativa — cookie httpOnly — exigiria o backend em
 * um domínio que permita cookie de terceiros, o que os navegadores estão
 * desativando. Como o conteúdo é sempre renderizado por `textContent` e nunca
 * por HTML bruto, não há superfície de XSS conhecida.
 */

import { apiUrl, apiConfigured } from '../core/config.js';
import { withTimeout } from '../core/async.js';
import { NETWORK } from '../core/constants.js';

const TOKEN_KEY = 'kyrios.token';
const USER_KEY = 'kyrios.user';

/* -------------------------------------------------------------------------- */
/* Sessão                                                                      */
/* -------------------------------------------------------------------------- */

/** Token do administrador, ou null. */
export function token() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Usuário administrador guardado, ou null. */
export function storedUser() {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Guarda a sessão. */
export function setSession({ token: value, user }) {
  try {
    window.localStorage.setItem(TOKEN_KEY, value);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Armazenamento bloqueado (modo privado): a sessão vale só em memória.
  }
}

/** Descarta a sessão. */
export function clearSession() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // nada a fazer
  }
}

/** Indica se há um token guardado. */
export function hasSession() {
  return Boolean(token());
}

/* -------------------------------------------------------------------------- */
/* Requisições                                                                 */
/* -------------------------------------------------------------------------- */

/** Erro de API, com o status HTTP preservado. */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Status de "endereço da API não configurado".
 *
 * Não é um status HTTP: nenhuma requisição chega a sair. Existe para que a
 * interface distinga "não configurado" de "fora do ar", que pedem ações
 * diferentes do usuário.
 */
export const API_NOT_CONFIGURED = 'not-configured';

/**
 * Executa uma requisição à API.
 *
 * @param {string} path
 * @param {{method?: string, body?: unknown, auth?: boolean, timeoutMs?: number}} [options]
 */
export async function request(path, options = {}) {
  const { method = 'GET', body, auth = false, timeoutMs = NETWORK.apiTimeoutMs } = options;

  // Sem endereço público configurado, o padrão é o backend de desenvolvimento.
  // Fora do localhost esse endereço não existe, e tentar alcançá-lo produziria
  // ERR_CONNECTION_REFUSED no console de quem visita o site publicado.
  if (!apiConfigured) {
    throw new ApiError(
      'A API não está configurada. Defina PRODUCTION_API em js/core/config.js com o endereço do backend publicado.',
      API_NOT_CONFIGURED,
      null,
    );
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const value = token();
    if (!value) throw new ApiError('Sessão não encontrada. Entre novamente.', 401, null);
    headers.Authorization = `Bearer ${value}`;
  }

  const response = await withTimeout(
    fetch(apiUrl(path), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    timeoutMs,
    'falar com a API',
  );

  // Sessão expirada ou revogada: descarta para que a interface volte ao login
  // em vez de repetir uma requisição que nunca vai passar.
  if (response.status === 401 && auth) clearSession();

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || `Falha na API (${response.status}).`,
      response.status,
      data,
    );
  }

  return data;
}

export const get = (path, options) => request(path, { ...options, method: 'GET' });
export const post = (path, body, options) => request(path, { ...options, method: 'POST', body });
export const patch = (path, body, options) => request(path, { ...options, method: 'PATCH', body });
export const del = (path, options) => request(path, { ...options, method: 'DELETE' });

/**
 * Verifica se a API responde.
 * Usado para decidir entre modo demonstração e dados reais.
 */
export async function isApiReachable() {
  try {
    await request('/api/health', { timeoutMs: NETWORK.apiTimeoutMs });
    return true;
  } catch {
    return false;
  }
}
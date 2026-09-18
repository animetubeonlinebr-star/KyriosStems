/**
 * KyriosStems - backend/src/http/router.js
 * Roteador mínimo.
 *
 * A API tem poucas rotas e nenhuma necessidade de middleware encadeado, então
 * um roteador por expressão regular resolve sem trazer um framework inteiro.
 * Cada rota declara se exige autenticação, o que mantém a decisão de acesso
 * visível no mesmo lugar que o caminho.
 */

import { HttpError } from './respond.js';
import { verifyToken } from '../auth/tokens.js';

const routes = [];

/**
 * Registra uma rota.
 * @param {string} method
 * @param {string} pattern Caminho com segmentos `:nome`
 * @param {{auth?: boolean, handler: Function}} options
 */
export function route(method, pattern, { auth = false, handler }) {
  const names = [];
  const regex = new RegExp(
    `^${pattern
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':')) {
          return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        names.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/')}$`,
  );

  routes.push({ method, regex, names, auth, handler });
}

export const get = (pattern, options) => route('GET', pattern, options);
export const post = (pattern, options) => route('POST', pattern, options);
export const patch = (pattern, options) => route('PATCH', pattern, options);
export const del = (pattern, options) => route('DELETE', pattern, options);

/** Extrai o token do cabeçalho Authorization. */
function bearer(request) {
  const header = request.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Encontra e executa a rota correspondente.
 * @returns {Promise<boolean>} true se alguma rota respondeu
 */
export async function dispatch(request, response, context) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  for (const candidate of routes) {
    if (candidate.method !== request.method) continue;

    const match = url.pathname.match(candidate.regex);
    if (!match) continue;

    const params = Object.fromEntries(
      candidate.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]),
    );

    let admin = null;
    if (candidate.auth) {
      admin = verifyToken(bearer(request));
      if (!admin) throw new HttpError(401, 'Sessão inválida ou expirada. Entre novamente.');
    }

    await candidate.handler({ request, response, params, query: url.searchParams, admin, ...context });
    return true;
  }

  return false;
}
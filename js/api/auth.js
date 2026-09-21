/**
 * KyriosStems - js/api/auth.js
 * Autenticação administrativa.
 *
 * A autorização NÃO é decidida pela interface: quem decide é a API, que
 * verifica o token e o registro do administrador no banco. Este módulo apenas
 * evita exibir uma interface que não funcionaria.
 */

import { get, post, setSession, clearSession, token, storedUser, API_NOT_CONFIGURED } from './client.js';
import { ROUTES } from '../core/constants.js';

/** Erros de autenticação traduzidos para português. */
const AUTH_ERRORS = {
  401: 'E-mail ou senha incorretos.',
  403: 'Esta conta não possui acesso administrativo.',
  429: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
};

/** Traduz um erro da API para mensagem exibível. */
export function authErrorMessage(error) {
  if (AUTH_ERRORS[error?.status]) return AUTH_ERRORS[error.status];
  // Endereço não configurado não é falha de rede: a mensagem original já
  // orienta o que fazer, então não é substituída pela genérica.
  if (error?.status !== API_NOT_CONFIGURED
      && (error?.status === 0 || /Failed to fetch/i.test(error?.message || ''))) {
    return 'Não foi possível falar com a API. Verifique se o backend está no ar.';
  }
  return error?.message || 'Falha na autenticação.';
}

/**
 * Autentica com e-mail e senha.
 * @returns {Promise<{user: object}>}
 */
export async function signIn(email, password) {
  const data = await post('/api/auth/login', { email, password });
  setSession({ token: data.token, user: data.user });
  return { user: data.user };
}

/** Encerra a sessão local. O token é stateless; descartá-lo já basta. */
export function signOut() {
  clearSession();
}

/** Usuário autenticado no momento, ou null. */
export function currentUser() {
  return storedUser();
}

/** Indica se há uma sessão guardada. */
export function isSignedIn() {
  return Boolean(token());
}

/**
 * Confirma com a API que o token guardado ainda vale.
 *
 * Guardar a sessão no navegador não prova nada: o token pode ter expirado ou a
 * conta pode ter sido removida. Só a API decide.
 *
 * @returns {Promise<{user: object}|null>}
 */
export async function verifySession() {
  if (!token()) return null;

  try {
    const data = await get('/api/auth/me', { auth: true });
    return { user: data.user };
  } catch {
    // 401 já limpa a sessão dentro do cliente.
    return null;
  }
}

/**
 * Resolve o estado inicial e redireciona quem não é administrador.
 *
 * Use no topo de páginas restritas. A decisão definitiva continua sendo da API:
 * mesmo que alguém contorne este redirecionamento, as rotas de escrita recusam.
 *
 * @param {{redirectTo?: string}} [options]
 * @returns {Promise<{user: object}|null>}
 */
export async function requireAdmin({ redirectTo = ROUTES.login } = {}) {
  if (!isSignedIn()) {
    window.location.replace(`${redirectTo}?motivo=nao-autorizado`);
    return null;
  }

  const session = await verifySession();

  if (!session) {
    window.location.replace(`${redirectTo}?motivo=nao-autorizado`);
    return null;
  }

  return session;
}
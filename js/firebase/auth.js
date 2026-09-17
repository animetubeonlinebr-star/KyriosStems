/**
 * KyriosStems - js/firebase/auth.js
 * Autenticação e autorização administrativa.
 *
 * A autorização NÃO é decidida pela interface. A existência de uma tela de
 * login não autoriza ninguém: o acesso é concedido pela custom claim
 * `admin: true` no token do usuário e verificado pelas Security Rules. Este
 * módulo apenas evita exibir uma interface que não funcionaria.
 */

import { initFirebase, isFirebaseConfigured } from './app.js';
import { NETWORK } from '../core/constants.js';
import { withTimeout } from '../core/async.js';

/** Erros do Firebase Authentication traduzidos para português. */
const AUTH_ERRORS = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'Conta não encontrada.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Falha de rede. Verifique a conexão.',
  'auth/operation-not-allowed':
    'O login por e-mail/senha não está habilitado no console do Firebase.',
  'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.',
  'auth/configuration-not-found':
    'O provedor de e-mail/senha não está ativado no projeto Firebase. Ative em Authentication > Sign-in method.',
  'auth/operation-not-supported-in-this-environment':
    'Este ambiente não suporta autenticação. Use http:// ou https:// em vez de file://.',
};

/** Traduz um erro do SDK para mensagem exibível. */
export function authErrorMessage(error) {
  return AUTH_ERRORS[error?.code] || error?.message || 'Falha na autenticação.';
}

/**
 * Autentica com e-mail e senha.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signIn(email, password) {
  const { auth, sdk } = await initFirebase();
  return withTimeout(
    sdk.authModule.signInWithEmailAndPassword(auth, String(email).trim(), password),
    NETWORK.authTimeoutMs,
    'entrar',
  );
}

/** Encerra a sessão. */
export async function signOut() {
  const { auth, sdk } = await initFirebase();
  return sdk.authModule.signOut(auth);
}

/** Usuário autenticado no momento, ou null. */
export async function currentUser() {
  if (!isFirebaseConfigured()) return null;
  const { auth } = await initFirebase();
  return auth.currentUser;
}

/**
 * Verifica se o usuário possui a custom claim de administrador.
 *
 * `forceRefresh` busca um token novo. É necessário logo após a concessão da
 * claim, porque o token em cache ainda não a contém.
 *
 * @param {object} user
 * @param {boolean} [forceRefresh]
 * @returns {Promise<boolean>}
 */
export async function isAdmin(user = null, forceRefresh = false) {
  const target = user ?? (await currentUser());
  if (!target) return false;

  try {
    const result = await target.getIdTokenResult(forceRefresh);
    return result?.claims?.admin === true;
  } catch {
    return false;
  }
}

/**
 * Observa mudanças no estado de autenticação.
 * @param {(session: {user: object|null, isAdmin: boolean}) => void} callback
 * @returns {() => void} Cancela a observação
 */
export async function observeAuth(callback) {
  if (!isFirebaseConfigured()) {
    callback({ user: null, isAdmin: false });
    return () => {};
  }

  const { auth, sdk } = await initFirebase();

  return sdk.authModule.onAuthStateChanged(auth, async (user) => {
    callback({ user, isAdmin: user ? await isAdmin(user) : false });
  });
}

/**
 * Resolve o estado inicial e redireciona quem não é administrador.
 *
 * Use no topo de páginas restritas. A decisão definitiva continua sendo das
 * Security Rules: mesmo que alguém contorne este redirecionamento, o Firestore
 * e o Storage recusam a escrita.
 *
 * @param {{redirectTo?: string}} [options]
 * @returns {Promise<{user: object, isAdmin: boolean}|null>}
 */
export async function requireAdmin({ redirectTo = 'login.html' } = {}) {
  if (!isFirebaseConfigured()) {
    window.location.replace(`${redirectTo}?motivo=nao-configurado`);
    return null;
  }

  let session;
  try {
    session = await withTimeout(
      new Promise((resolve, reject) => {
        observeAuth(resolve).catch(reject);
      }),
      NETWORK.authTimeoutMs,
      'verificar a sessão',
    );
  } catch {
    window.location.replace(`${redirectTo}?motivo=tempo-esgotado`);
    return null;
  }

  if (!session.user || !session.isAdmin) {
    window.location.replace(`${redirectTo}?motivo=nao-autorizado`);
    return null;
  }

  return session;
}
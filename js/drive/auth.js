/**
 * KyriosStems - js/drive/auth.js
 * Autorização do Google Drive no próprio navegador.
 *
 * Por que não há backend: o Google Identity Services (modelo de token) devolve
 * um access token de curta duração a partir de um `client_id` PÚBLICO, sem
 * `client_secret`. É o fluxo oficial para aplicações no navegador, e é o que
 * permite a aplicação continuar estática e ainda assim escrever no Drive.
 *
 * O token vive em memória, nunca em `localStorage`: a autorização não deve
 * sobreviver ao fechamento do navegador, e um token de acesso em armazenamento
 * persistente seria alvo fácil. Ao recarregar a página, pede-se de novo.
 *
 * O escopo `drive.file` dá acesso apenas aos arquivos que ESTA aplicação criou.
 * Ela não consegue ler nem alterar o resto do Drive do usuário.
 */

import { GOOGLE } from '../core/constants.js';
import { googleClientId } from '../firebase/config.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Token em memória. `null` enquanto não houver autorização. */
let accessToken = null;

/** Momento (epoch ms) em que o token expira. */
let expiresAt = 0;

let gisPromise = null;

/** Indica se há um `client_id` do Google configurado. */
export function isDriveConfigured() {
  return (
    typeof googleClientId === 'string' &&
    googleClientId.length > 0 &&
    !googleClientId.startsWith('COLE_AQUI')
  );
}

/** Carrega a biblioteca do Google Identity Services, uma única vez. */
function loadGis() {
  if (gisPromise) return gisPromise;

  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google.accounts.oauth2);
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2);
      else reject(new Error('A biblioteca de autorização do Google não inicializou.'));
    };
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Não foi possível carregar a autorização do Google. Verifique a conexão.'));
    };

    document.head.append(script);
  });

  return gisPromise;
}

/**
 * Indica se o token atual ainda vale.
 * A folga evita que ele expire no meio de um envio longo.
 */
export function hasValidToken() {
  return Boolean(accessToken) && Date.now() < expiresAt - GOOGLE.tokenSafetyMarginMs;
}

/** Token atual, ou null. */
export function driveToken() {
  return hasValidToken() ? accessToken : null;
}

/** Descarta a autorização em memória. */
export function forgetDriveToken() {
  accessToken = null;
  expiresAt = 0;
}

/**
 * Pede autorização ao usuário e guarda o token.
 *
 * Precisa partir de um gesto do usuário (clique): o Google bloqueia a janela de
 * consentimento aberta sem interação.
 *
 * @returns {Promise<string>} o access token
 */
export async function authorizeDrive() {
  if (hasValidToken()) return accessToken;

  if (!isDriveConfigured()) {
    throw new Error(
      'O acesso ao Google Drive não está configurado. Defina googleClientId em js/firebase/config.js.',
    );
  }

  const oauth2 = await loadGis();

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: googleClientId,
      scope: GOOGLE.driveScope,
      callback: (response) => {
        if (response?.error) {
          reject(new Error(traduzErro(response.error)));
          return;
        }
        if (!response?.access_token) {
          reject(new Error('A autorização do Google não devolveu um token.'));
          return;
        }

        accessToken = response.access_token;
        // `expires_in` vem em segundos; zero significa "não informado".
        const seconds = Number(response.expires_in) || GOOGLE.defaultTokenTtlSeconds;
        expiresAt = Date.now() + seconds * 1000;
        resolve(accessToken);
      },
      error_callback: (error) => {
        reject(new Error(traduzErro(error?.type || error?.message)));
      },
    });

    client.requestAccessToken();
  });
}

/**
 * Garante um token válido, pedindo autorização quando necessário.
 * Use antes de qualquer operação no Drive.
 */
export async function requireDriveToken() {
  if (hasValidToken()) return accessToken;
  return authorizeDrive();
}

function traduzErro(code) {
  const mensagens = {
    access_denied:
      'A autorização do Google foi recusada. Sem ela, não é possível enviar nem baixar arquivos.',
    popup_closed: 'A janela de autorização do Google foi fechada antes de concluir.',
    popup_blocked: 'O navegador bloqueou a janela de autorização. Permita pop-ups para este site.',
    invalid_client:
      'O identificador do Google não foi aceito. Confira googleClientId em js/firebase/config.js.',
  };
  return mensagens[code] || `Falha na autorização do Google (${code || 'motivo desconhecido'}).`;
}

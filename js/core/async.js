/**
 * KyriosStems - js/core/async.js
 * Utilidades para operações que dependem da rede.
 *
 * Uma requisição sem resposta deixa a interface carregando indefinidamente, sem
 * dizer o que está acontecendo. Todo acesso à rede passa por aqui para que
 * exista um prazo e uma mensagem de erro úteis.
 */

/**
 * Rejeita se a promise não liquidar dentro do prazo.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label Descrição da operação, usada na mensagem de erro
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Tempo esgotado ao ${label}. Verifique a conexão e as Security Rules.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Indica se o navegador está sem conexão. */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
/**
 * KyriosStems - js/core/config.js
 * Endereço da API.
 *
 * O frontend é estático (GitHub Pages) e o backend roda em outro domínio, então
 * o endereço precisa ser explícito. Nada de segredo aqui: a única credencial
 * que o navegador guarda é o token de sessão do administrador, obtido no login.
 *
 * Para desenvolvimento local, crie js/core/config.local.js (não versionado)
 * exportando o mesmo `apiBaseUrl`; ele tem precedência.
 */

let override = null;

try {
  // Arquivo opcional, criado à mão para apontar para um backend local.
  const local = await import('./config.local.js');
  override = local.apiBaseUrl ?? null;
} catch {
  // Ausência é o caso normal em produção.
}

/** URL base da API, sem barra final. */
export const apiBaseUrl = (override || 'http://localhost:8080').replace(/\/+$/, '');

/** Monta a URL absoluta de um caminho da API. */
export function apiUrl(path) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
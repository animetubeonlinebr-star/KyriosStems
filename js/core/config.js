/**
 * KyriosStems - js/core/config.js
 * Endereço da API.
 *
 * O frontend é estático (GitHub Pages) e o backend roda em outro domínio, então
 * o endereço precisa ser explícito. Nada de segredo aqui: a única credencial
 * que o navegador guarda é o token de sessão do administrador, obtido no login.
 *
 * Para publicar, troque `PRODUCTION_API` pelo endereço do backend. Em
 * desenvolvimento, mantenha `DEVELOPMENT_API`.
 *
 * Não existe override por arquivo nem por query string: o deploy remove
 * arquivos `*.local.js` do site, então o override por arquivo nunca funcionou
 * em produção e ainda gerava um 404 no console de todo visitante. Um override
 * por query string seria pior: permitiria apontar a API para um servidor
 * alheio e colher o token de sessão do administrador.
 */

/** Endereço do backend de desenvolvimento local. */
const DEVELOPMENT_API = 'http://localhost:8080';

/** Endereço do backend publicado. Troque antes de publicar o site. */
const PRODUCTION_API = '';

/** Hosts em que o backend de desenvolvimento existe. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]', ''];

const isLocal = LOCAL_HOSTS.includes(window.location.hostname);

/**
 * URL base da API, sem barra final.
 *
 * O endereço vazio (produção não configurada) é tratado como ausente, e não
 * como caminho relativo: `apiUrl('/x')` nunca deve virar `/x` no domínio do
 * site, que devolveria o próprio HTML.
 */
export const apiBaseUrl = (isLocal ? DEVELOPMENT_API : PRODUCTION_API).replace(/\/+$/, '');

/**
 * Indica que há um endereço utilizável.
 *
 * Fora do localhost, sem `PRODUCTION_API` preenchido o padrão apontaria para a
 * máquina de quem visita, onde não há backend. A interface usa esta flag para
 * dizer que a API não foi configurada, em vez de gastar uma requisição que só
 * pode falhar — o que produziria ERR_CONNECTION_REFUSED no console.
 */
export const apiConfigured = Boolean(apiBaseUrl);

/** Monta a URL absoluta de um caminho da API. */
export function apiUrl(path) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
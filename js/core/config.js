/**
 * KyriosStems - js/core/config.js
 * Configuração da biblioteca no Google Drive.
 *
 * A aplicação é estática e roda inteira no navegador. Não há backend, não há
 * login e não há segredo algum neste arquivo.
 *
 * COMO FUNCIONA
 *
 * A biblioteca é uma pasta no Google Drive compartilhada como "qualquer pessoa
 * com o link". O navegador lê a listagem e baixa os arquivos usando a API do
 * Drive com uma API key — que é pública por natureza. Não é preciso OAuth nem
 * conta Google para CONSULTAR: só para escrever, que nesta etapa é feito
 * arrastando arquivos no próprio Drive.
 *
 * ESTRUTURA DA PASTA
 *
 *   {pasta raiz}/
 *     ├── song.json               metadados da música (opcional)
 *     ├── capa.jpg                capa (opcional)
 *     └── {id da sessão}/         uma pasta por sessão
 *          ├── session.zip        pacote principal
 *          ├── projeto.rpp
 *          └── 01 Drums.wav
 *
 * Organizar a biblioteca é organizar pastas: a estrutura no Drive é a fonte
 * da verdade, e não há banco de dados para manter em sincronia.
 */

/**
 * API key do Google Cloud, restrita à Drive API.
 *
 * É PÚBLICA de propósito, e não um segredo: ela identifica a aplicação, não o
 * usuário. Restrinja-a no Google Cloud para que só estes domínios possam usá-la
 * (senão alguém consome a sua cota):
 *   http://localhost:12000
 *   https://animetubeonlinebr-star.github.io
 */
export const driveApiKey = 'COLE_AQUI_SUA_API_KEY';

/**
 * Id da pasta raiz da biblioteca no Drive.
 *
 * É o trecho final da URL da pasta: em
 * https://drive.google.com/drive/folders/1AbC...XYZ, o id é `1AbC...XYZ`.
 *
 * A pasta precisa estar compartilhada como "qualquer pessoa com o link".
 */
export const driveRootFolderId = '';

/** Endpoints da API do Drive. */
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/** Nome do arquivo de metadados dentro da pasta da música. */
export const SONG_METADATA_FILE = 'song.json';

/** Nomes aceitos para o arquivo de capa. */
export const COVER_FILE_NAMES = ['capa.jpg', 'capa.png', 'cover.jpg', 'cover.png'];

/**
 * Indica se a configuração foi preenchida.
 *
 * Enquanto não estiver, a aplicação mostra a biblioteca de demonstração e
 * explica o que falta, em vez de tentar uma requisição que só pode falhar.
 */
export function isDriveConfigured() {
  return (
    typeof driveApiKey === 'string' &&
    driveApiKey.length > 0 &&
    !driveApiKey.startsWith('COLE_AQUI') &&
    typeof driveRootFolderId === 'string' &&
    driveRootFolderId.length > 0
  );
}

/** Monta a URL de um caminho da API do Drive, já com a API key. */
export function driveUrl(path, params = {}) {
  const url = new URL(`${DRIVE_API}${path}`);
  url.searchParams.set('key', driveApiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

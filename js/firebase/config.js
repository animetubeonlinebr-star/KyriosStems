/**
 * KyriosStems - js/firebase/config.js
 *
 * Configuração do Firebase Web SDK.
 *
 * IMPORTANTE: estas chaves são públicas por natureza (o Firebase Web SDK é
 * embarcado no navegador). A proteção real dos dados vem das Security Rules do
 * Firestore e do Storage, e da restrição de domínio nas chaves de API.
 *
 * A aplicação entra em MODO DEMONSTRAÇÃO quando a configuração ainda tem
 * valores de exemplo (veja `isFirebaseConfigured`), ou quando uma leitura falha
 * — nesse caso o catálogo avisa que os dados exibidos não são reais.
 *
 * Serviços exigidos no projeto:
 * - Authentication (e-mail/senha) — acesso administrativo
 * - Cloud Firestore — músicas e sessões
 * - Cloud Storage — pacotes e arquivos de áudio
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyBiJpi-h2pzJ8-7zR7ia9FGHdrRosAEjY8',
  authDomain: 'kyriosstems.firebaseapp.com',
  projectId: 'kyriosstems',
  storageBucket: 'kyriosstems.firebasestorage.app',
  messagingSenderId: '460854566537',
  appId: '1:460854566537:web:1b1886d3cec8cff4417058',
};

/**
 * E-mail do administrador, usado apenas para orientar a tela de login sobre
 * qual conta é a esperada. A autorização real vem da custom claim `admin: true`
 * no token do Firebase Authentication, verificada nas Security Rules.
 */
export const adminEmail = 'admin@kyriosstems.local';

/** Versão do Firebase Web SDK (ES Modules via CDN). */
export const FIREBASE_SDK_VERSION = '10.14.1';

/**
 * Identificador OAuth do Google para acesso ao Drive pelo navegador.
 *
 * PÚBLICO de propósito, e não um segredo: o fluxo do Google Identity Services
 * foi desenhado para aplicações no navegador e não usa `client_secret`. Quem
 * protege é o cadastro de "Authorized JavaScript origins" no Google Cloud — só
 * as origens listadas conseguem obter consentimento. Restrinja a:
 *   http://localhost:12000
 *   https://animetubeonlinebr-star.github.io
 */
export const googleClientId = 'COLE_AQUI_O_CLIENT_ID.apps.googleusercontent.com';

/**
 * Pasta do Drive que guarda a biblioteca.
 *
 * Deixe vazio para usar a raiz do Drive da conta autorizada — a aplicação cria
 * uma pasta `KyriosStems` ali. Preencha com o id da pasta (o trecho final da URL
 * no Drive) para guardar dentro de uma pasta específica.
 *
 * O id não é segredo: sem autorização, ele não dá acesso a nada.
 */
export const driveRootFolderId = '';

/**
 * Indica se a configuração foi preenchida com valores reais.
 * @returns {boolean}
 */
export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (value) => typeof value === 'string' && value.length > 0 && !isPlaceholder(value),
  );
}

function isPlaceholder(value) {
  return (
    value.startsWith('COLE_AQUI') ||
    value.startsWith('SEU_') ||
    value.includes('SEU_PROJETO')
  );
}
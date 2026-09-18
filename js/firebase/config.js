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
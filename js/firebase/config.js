/**
 * KyriosStems - js/firebase/config.js
 *
 * Configuração do Firebase Web SDK.
 *
 * Preencha os valores abaixo com os dados do seu projeto Firebase.
 * Eles estão disponíveis em: Console do Firebase > Configurações do projeto >
 * Seus apps > App da Web > Configuração do SDK.
 *
 * IMPORTANTE: estas chaves são públicas por natureza (o Firebase Web SDK é
 * embarcado no navegador). A proteção real dos dados vem das Security Rules do
 * Firestore e do Storage, e da restrição do domínio nas chaves de API.
 *
 * Enquanto este arquivo mantiver os valores de exemplo, a aplicação entra em
 * MODO DEMONSTRAÇÃO: o catálogo é exibido com dados locais, o login fica
 * indisponível e o download é bloqueado.
 */

export const firebaseConfig = {
  apiKey: 'COLE_AQUI_A_API_KEY',
  authDomain: 'SEU_PROJETO.firebaseapp.com',
  projectId: 'SEU_PROJETO',
  storageBucket: 'SEU_PROJETO.appspot.com',
  messagingSenderId: 'SEU_SENDER_ID',
  appId: 'SEU_APP_ID',
};

/**
 * Identificador do administrador.
 * O acesso administrativo é concedido por custom claim `admin: true` no token
 * do Firebase Authentication. O e-mail abaixo é usado apenas como referência de
 * exibição e para a tela de login indicar qual conta é a esperada.
 */
export const adminEmail = 'admin@exemplo.com';

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
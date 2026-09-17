/**
 * KyriosStems - js/firebase/app.js
 * Inicialização única do Firebase e acesso aos serviços do SDK.
 *
 * Os módulos do SDK são carregados dinamicamente pelo CDN apenas quando a
 * configuração está preenchida. Sem configuração, a aplicação opera em modo
 * demonstração e nenhum recurso de rede é carregado.
 */

import { firebaseConfig, FIREBASE_SDK_VERSION, isFirebaseConfigured } from './config.js';

const CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

/** @type {Promise<{app: object, auth: object, db: object, storage: object, sdk: object}>|null} */
let servicesPromise = null;

export { isFirebaseConfigured };

/** Carrega um módulo do SDK do Firebase a partir do CDN. */
function loadSdk(moduleName) {
  return import(/* @vite-ignore */ `${CDN_BASE}/firebase-${moduleName}.js`);
}

/**
 * Inicializa o Firebase uma única vez e reutiliza a mesma instância.
 *
 * Uma tentativa que falha (CDN fora do ar, rede instável) é descartada do
 * cache, para que a próxima chamada tente de novo em vez de repetir o erro
 * para sempre.
 *
 * @returns {Promise<{app: object, auth: object, db: object, storage: object, sdk: object}>}
 */
export function initFirebase() {
  if (servicesPromise) return servicesPromise;

  servicesPromise = createServices().catch((error) => {
    servicesPromise = null;
    throw error;
  });

  return servicesPromise;
}

async function createServices() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase não configurado. Preencha js/firebase/config.js.');
  }

  const [appModule, authModule, firestoreModule, storageModule] = await Promise.all([
    loadSdk('app'),
    loadSdk('auth'),
    loadSdk('firestore'),
    loadSdk('storage'),
  ]);

  const app = appModule.getApps().length
    ? appModule.getApp()
    : appModule.initializeApp(firebaseConfig);

  return {
    app,
    auth: authModule.getAuth(app),
    db: firestoreModule.getFirestore(app),
    storage: storageModule.getStorage(app),
    sdk: { appModule, authModule, firestoreModule, storageModule },
  };
}
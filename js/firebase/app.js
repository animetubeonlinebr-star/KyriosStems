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

/** @type {Promise<import('firebase/app').FirebaseApp>|null} */
let appPromise = null;
/** @type {Promise<object>|null} */
let servicesPromise = null;

export { isFirebaseConfigured };

/** Carrega um módulo do SDK do Firebase a partir do CDN. */
function loadSdk(moduleName) {
  return import(/* @vite-ignore */ `${CDN_BASE}/firebase-${moduleName}.js`);
}

/**
 * Inicializa o Firebase uma única vez.
 * @returns {Promise<object>} { app, auth, db, storage, sdk }
 */
export function initFirebase() {
  if (servicesPromise) return servicesPromise;

  servicesPromise = (async () => {
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

    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);
    const storage = storageModule.getStorage(app);

    return { app, auth, db, storage, sdk: { appModule, authModule, firestoreModule, storageModule } };
  })();

  return servicesPromise;
}

/** Acesso ao app já inicializado (ou null). */
export function getFirebaseApp() {
  return appPromise;
}

/**
 * Reinicia o estado de inicialização. Usado em testes e no logout completo.
 */
export function resetFirebase() {
  appPromise = null;
  servicesPromise = null;
}
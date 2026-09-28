/**
 * KyriosStems - js/firebase/app.js
 * Inicialização do Firebase para a tela temporária de cadastro.
 *
 * Os módulos do SDK são carregados do CDN apenas quando a configuração está
 * preenchida. Sem configuração, nada de rede é carregado — a tela apenas
 * explica o que falta.
 */

import { firebaseConfig, FIREBASE_SDK_VERSION, isFirebaseConfigured } from './config.js';

const CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

/** @type {Promise<object>|null} */
let servicesPromise = null;

export { isFirebaseConfigured };

function loadSdk(moduleName) {
  return import(/* @vite-ignore */ `${CDN_BASE}/firebase-${moduleName}.js`);
}

/**
 * Inicializa o Firebase uma única vez e reutiliza a instância.
 *
 * Uma tentativa que falha (CDN fora do ar) é descartada do cache, para que a
 * próxima chamada tente de novo em vez de repetir o erro para sempre.
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
    throw new Error('O Firebase ainda não foi configurado. Preencha js/firebase/config.js.');
  }

  const [appModule, authModule, firestoreModule] = await Promise.all([
    loadSdk('app'),
    loadSdk('auth'),
    loadSdk('firestore'),
  ]);

  const app = appModule.getApps().length
    ? appModule.getApp()
    : appModule.initializeApp(firebaseConfig);

  return {
    app,
    auth: authModule.getAuth(app),
    db: firestoreModule.getFirestore(app),
    sdk: { appModule, authModule, firestoreModule },
  };
}

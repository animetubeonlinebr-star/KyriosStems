/**
 * KyriosStems - js/repositories/firestore-repository.js
 * Persistência de músicas e sessões.
 *
 * Comportamento de leitura:
 * - Sem Firebase configurado: modo demonstração, dados locais, sem rede.
 * - Firebase configurado: lê do Firestore com limite de tempo.
 * - Falha de leitura: devolve a biblioteca de demonstração JUNTO com o erro,
 *   para que a interface avise que os dados exibidos não são reais. Sem esse
 *   aviso, o usuário acreditaria estar vendo a biblioteca verdadeira.
 *
 * Escritas nunca degradam: falham explicitamente, porque só o administrador
 * escreve e um erro silencioso aqui seria destrutivo.
 */

import { initFirebase, isFirebaseConfigured } from '../firebase/app.js';
import { COLLECTIONS, NETWORK } from '../core/constants.js';
import { withTimeout } from '../core/async.js';
import { demoLibrary } from '../data/demo-data.js';
import * as Song from '../models/song.js';
import * as DawSession from '../models/daw-session.js';

/** Origem dos dados de uma leitura. */
export const SOURCE = {
  firestore: 'firestore',
  demo: 'demo',
};

/* -------------------------------------------------------------------------- */
/* Leituras                                                                    */
/* -------------------------------------------------------------------------- */

/** Lê todas as músicas. */
export function fetchSongs() {
  return readCollection(COLLECTIONS.songs, Song.fromDocument, demoSongs);
}

/** Lê todas as sessões. */
export function fetchSessions() {
  return readCollection(COLLECTIONS.sessions, DawSession.fromDocument, demoSessions);
}

/** Lê uma música pelo id. */
export function fetchSong(songId) {
  const demo = () => demoLibrary().find((entry) => entry.song.id === songId)?.song ?? null;

  if (!isFirebaseConfigured()) {
    return Promise.resolve({ item: demo(), source: SOURCE.demo, error: null });
  }

  return readOne(demo, async (sdk, db) => {
    const snapshot = await sdk.firestoreModule.getDoc(
      sdk.firestoreModule.doc(db, COLLECTIONS.songs, songId),
    );
    return snapshot.exists() ? Song.fromDocument(snapshot.id, snapshot.data()) : null;
  });
}

/** Lê as sessões de uma música. */
export function fetchSessionsBySong(songId) {
  const demo = () => demoLibrary().find((entry) => entry.song.id === songId)?.sessions ?? [];

  if (!isFirebaseConfigured()) {
    return Promise.resolve({ items: demo(), source: SOURCE.demo, error: null });
  }

  return readList(demo, async (sdk, db) => {
    const snapshot = await sdk.firestoreModule.getDocs(
      sdk.firestoreModule.query(
        sdk.firestoreModule.collection(db, COLLECTIONS.sessions),
        sdk.firestoreModule.where('songId', '==', songId),
      ),
    );
    return snapshot.docs.map((item) => DawSession.fromDocument(item.id, item.data()));
  });
}

/* -------------------------------------------------------------------------- */
/* Leitura resiliente                                                          */
/* -------------------------------------------------------------------------- */

/** Lê uma coleção inteira do Firestore. */
function readCollection(name, mapper, demo) {
  if (!isFirebaseConfigured()) {
    return Promise.resolve({ items: demo(), source: SOURCE.demo, error: null });
  }

  return readList(demo, async (sdk, db) => {
    const snapshot = await sdk.firestoreModule.getDocs(sdk.firestoreModule.collection(db, name));
    return snapshot.docs.map((doc) => mapper(doc.id, doc.data()));
  });
}

/**
 * Lê uma lista com limite de tempo, degradando para dados locais.
 *
 * Sem limite, uma leitura do Firestore em dispositivo offline não rejeita: ela
 * repete com backoff e a interface fica carregando indefinidamente. O erro é
 * devolvido junto para que a interface possa avisar o usuário.
 *
 * @param {() => any[]} demo
 * @param {(sdk: object, db: object) => Promise<any[]>} load
 */
async function readList(demo, load) {
  try {
    return { items: await run(load), source: SOURCE.firestore, error: null };
  } catch (error) {
    return { items: demo(), source: SOURCE.demo, error: describe(error) };
  }
}

/** Igual a `readList`, para um único documento. */
async function readOne(demo, load) {
  try {
    return { item: await run(load), source: SOURCE.firestore, error: null };
  } catch (error) {
    return { item: demo(), source: SOURCE.demo, error: describe(error) };
  }
}

/** Inicializa o SDK e executa a consulta, ambos com limite de tempo. */
async function run(load) {
  const { db, sdk } = await withTimeout(
    initFirebase(),
    NETWORK.sdkTimeoutMs,
    'carregar o SDK do Firebase',
  );
  return withTimeout(load(sdk, db), NETWORK.readTimeoutMs, 'consultar o Firestore');
}

function demoSongs() {
  return demoLibrary().map((entry) => entry.song);
}

function demoSessions() {
  return demoLibrary().flatMap((entry) => entry.sessions);
}

/** Traduz erros do SDK em mensagens acionáveis. */
function describe(error) {
  if (error?.code === 'permission-denied') {
    return 'Leitura negada pelas Security Rules do Firestore. Publique as regras descritas em docs/security.md.';
  }
  if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
    return 'O Firestore não respondeu. Verifique a conexão com a internet.';
  }
  if (error?.code === 'failed-precondition') {
    return 'O Firestore não está provisionado neste projeto. Ative o banco no console do Firebase.';
  }
  return error instanceof Error ? error.message : String(error);
}

/* -------------------------------------------------------------------------- */
/* Escritas (somente administrador)                                            */
/* -------------------------------------------------------------------------- */

/** Cria uma música com id explícito. */
export async function createSong(song) {
  const { db, sdk } = await initFirebase();
  const payload = Song.toDocument(song);
  await sdk.firestoreModule.setDoc(sdk.firestoreModule.doc(db, COLLECTIONS.songs, song.id), payload);
  return { ...payload, id: song.id };
}

/** Atualiza campos de uma música. */
export async function updateSong(songId, changes) {
  const { db, sdk } = await initFirebase();
  const payload = { ...changes, updatedAt: new Date().toISOString() };
  await sdk.firestoreModule.updateDoc(
    sdk.firestoreModule.doc(db, COLLECTIONS.songs, songId),
    payload,
  );
  return payload;
}

/** Exclui uma música e todas as suas sessões. */
export async function deleteSong(songId) {
  const { db, sdk } = await initFirebase();
  const sessions = await sdk.firestoreModule.getDocs(
    sdk.firestoreModule.query(
      sdk.firestoreModule.collection(db, COLLECTIONS.sessions),
      sdk.firestoreModule.where('songId', '==', songId),
    ),
  );

  const batch = sdk.firestoreModule.writeBatch(db);
  for (const doc of sessions.docs) batch.delete(doc.ref);
  batch.delete(sdk.firestoreModule.doc(db, COLLECTIONS.songs, songId));
  await batch.commit();
}

/** Cria uma sessão. */
export async function createSession(session) {
  const { db, sdk } = await initFirebase();
  const payload = DawSession.toDocument(session);
  await sdk.firestoreModule.setDoc(
    sdk.firestoreModule.doc(db, COLLECTIONS.sessions, session.id),
    payload,
  );
  return { ...payload, id: session.id };
}

/** Atualiza campos de uma sessão. */
export async function updateSession(sessionId, changes) {
  const { db, sdk } = await initFirebase();
  const payload = { ...changes, updatedAt: new Date().toISOString() };
  await sdk.firestoreModule.updateDoc(
    sdk.firestoreModule.doc(db, COLLECTIONS.sessions, sessionId),
    payload,
  );
  return payload;
}

/** Exclui uma sessão. */
export async function deleteSession(sessionId) {
  const { db, sdk } = await initFirebase();
  await sdk.firestoreModule.deleteDoc(sdk.firestoreModule.doc(db, COLLECTIONS.sessions, sessionId));
}
/**
 * KyriosStems - js/repositories/firestore-repository.js
 * Persistência de músicas e sessões.
 *
 * Leituras degradam para a biblioteca de demonstração quando o Firebase não
 * está configurado, está offline ou bloqueado por Security Rules. Escritas
 * nunca degradam: falham explicitamente, porque só o administrador escreve.
 */

import { initFirebase, isFirebaseConfigured } from '../firebase/app.js';
import { COLLECTIONS } from '../core/constants.js';
import { demoLibrary } from '../data/demo-data.js';
import * as Song from '../models/song.js';
import * as DawSession from '../models/daw-session.js';

/** Origem dos dados retornados nas leituras. */
export const SOURCE = {
  firestore: 'firestore',
  demo: 'demo',
};

/** Última origem usada; consumida pela barra de status do admin. */
let lastSource = null;

export function getLastSource() {
  return lastSource;
}

/** Lê todas as músicas. */
export async function fetchSongs() {
  if (!isFirebaseConfigured()) {
    lastSource = SOURCE.demo;
    return { items: demoLibrary().map((entry) => entry.song), source: SOURCE.demo, error: null };
  }

  try {
    const items = await readCollection(COLLECTIONS.songs, Song.fromDocument);
    lastSource = SOURCE.firestore;
    return { items, source: SOURCE.firestore, error: null };
  } catch (error) {
    lastSource = SOURCE.demo;
    return {
      items: demoLibrary().map((entry) => entry.song),
      source: SOURCE.demo,
      error: message(error),
    };
  }
}

/** Lê todas as sessões. */
export async function fetchSessions() {
  if (!isFirebaseConfigured()) {
    lastSource = SOURCE.demo;
    return {
      items: demoLibrary().flatMap((entry) => entry.sessions),
      source: SOURCE.demo,
      error: null,
    };
  }

  try {
    const items = await readCollection(COLLECTIONS.sessions, DawSession.fromDocument);
    lastSource = SOURCE.firestore;
    return { items, source: SOURCE.firestore, error: null };
  } catch (error) {
    lastSource = SOURCE.demo;
    return {
      items: demoLibrary().flatMap((entry) => entry.sessions),
      source: SOURCE.demo,
      error: message(error),
    };
  }
}

/** Lê uma música pelo id. */
export async function fetchSong(songId) {
  if (!isFirebaseConfigured()) {
    const found = demoLibrary().find((entry) => entry.song.id === songId);
    return { item: found ? found.song : null, source: SOURCE.demo, error: null };
  }

  try {
    const { db, sdk } = await initFirebase();
    const snapshot = await sdk.firestoreModule.getDoc(
      sdk.firestoreModule.doc(db, COLLECTIONS.songs, songId),
    );
    if (!snapshot.exists()) return { item: null, source: SOURCE.firestore, error: null };
    return {
      item: Song.fromDocument(snapshot.id, snapshot.data()),
      source: SOURCE.firestore,
      error: null,
    };
  } catch (error) {
    const found = demoLibrary().find((entry) => entry.song.id === songId);
    return { item: found ? found.song : null, source: SOURCE.demo, error: message(error) };
  }
}

/** Lê as sessões de uma música. */
export async function fetchSessionsBySong(songId) {
  if (!isFirebaseConfigured()) {
    const found = demoLibrary().find((entry) => entry.song.id === songId);
    return { items: found ? found.sessions : [], source: SOURCE.demo, error: null };
  }

  try {
    const { db, sdk } = await initFirebase();
    const query = sdk.firestoreModule.query(
      sdk.firestoreModule.collection(db, COLLECTIONS.sessions),
      sdk.firestoreModule.where('songId', '==', songId),
    );
    const snapshot = await sdk.firestoreModule.getDocs(query);
    const items = snapshot.docs.map((doc) => DawSession.fromDocument(doc.id, doc.data()));
    return { items, source: SOURCE.firestore, error: null };
  } catch (error) {
    const found = demoLibrary().find((entry) => entry.song.id === songId);
    return { items: found ? found.sessions : [], source: SOURCE.demo, error: message(error) };
  }
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

/**
 * Exclui uma música e todas as suas sessões.
 * Os arquivos no Storage são removidos pelo chamador antes desta operação.
 */
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

/* -------------------------------------------------------------------------- */

async function readCollection(name, mapper) {
  const { db, sdk } = await initFirebase();
  const snapshot = await sdk.firestoreModule.getDocs(sdk.firestoreModule.collection(db, name));
  return snapshot.docs.map((doc) => mapper(doc.id, doc.data()));
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}
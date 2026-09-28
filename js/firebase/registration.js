/**
 * KyriosStems - js/firebase/registration.js
 * Cadastro de e-mail e senha na tela temporária.
 *
 * A senha NÃO é gravada por nós. Ela vai para o Firebase Authentication, que
 * guarda apenas o hash com salt e nunca a devolve. No Firestore gravamos
 * somente o e-mail e a data — o suficiente para a tela listar quem foi
 * cadastrado. Veja o comentário em config.js para o porquê.
 */

import { initFirebase } from './app.js';
import { REGISTRATIONS_COLLECTION } from './config.js';

/** Traduz os códigos de erro do Firebase em mensagens acionáveis. */
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'Este e-mail já foi cadastrado.',
  'auth/invalid-email': 'O e-mail informado não é válido.',
  'auth/weak-password': 'A senha é fraca demais. Use ao menos 6 caracteres.',
  'auth/operation-not-allowed':
    'O cadastro por e-mail e senha está desativado. Ative-o no console do Firebase, em Authentication > Sign-in method.',
  'auth/network-request-failed': 'Falha de rede. Verifique a conexão e tente novamente.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
};

export function describeAuthError(error) {
  const code = error?.code || '';
  if (AUTH_ERRORS[code]) return AUTH_ERRORS[code];

  if (code === 'permission-denied' || /permission/i.test(error?.message || '')) {
    return 'O Firestore recusou a gravação. Confira se as Security Rules foram publicadas.';
  }
  if (code === 'unavailable' || /Failed to fetch/i.test(error?.message || '')) {
    return 'Não foi possível falar com o Firebase. Verifique a conexão.';
  }
  return error?.message || 'Falha no cadastro.';
}

/**
 * Valida os campos antes de enviar.
 * Devolve a primeira mensagem de erro, ou null quando está tudo certo.
 */
export function validate({ email, password, confirmation }) {
  const value = String(email || '').trim();

  if (!value) return 'Informe o e-mail.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'O e-mail informado não é válido.';
  if (!password) return 'Informe a senha.';
  if (String(password).length < 6) return 'A senha precisa ter ao menos 6 caracteres.';
  if (password !== confirmation) return 'As senhas não coincidem.';

  return null;
}

/**
 * Cria a conta e registra o e-mail.
 *
 * A ordem importa: primeiro a conta. Se a gravação no Firestore falhar depois,
 * o usuário continua existindo e pode ser listado — o pior caso é um cadastro
 * sem registro, e não um registro apontando para uma conta que não existe.
 *
 * @param {{email: string, password: string}} params
 * @returns {Promise<{email: string, createdAt: string}>}
 */
export async function register({ email, password }) {
  const { auth, db, sdk } = await initFirebase();
  const { createUserWithEmailAndPassword, signOut } = sdk.authModule;

  const address = String(email).trim().toLowerCase();

  const credential = await createUserWithEmailAndPassword(auth, address, password);
  const createdAt = new Date().toISOString();

  await sdk.firestoreModule.setDoc(
    sdk.firestoreModule.doc(db, REGISTRATIONS_COLLECTION, credential.user.uid),
    { email: address, createdAt },
  );

  // A tela de cadastro não é uma sessão: encerra para não deixar o navegador
  // autenticado como o usuário recém-criado.
  await signOut(auth);

  return { email: address, createdAt };
}

/**
 * Lista os e-mails cadastrados.
 *
 * Se as rules negarem a leitura, a lista fica indisponível — e isso é
 * aceitável: o cadastro em si já funcionou.
 */
export async function listRegistrations() {
  const { db, sdk } = await initFirebase();
  const { collection, getDocs, query, orderBy } = sdk.firestoreModule;

  const snapshot = await getDocs(
    query(collection(db, REGISTRATIONS_COLLECTION), orderBy('createdAt', 'desc')),
  );

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

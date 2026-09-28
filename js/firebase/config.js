/**
 * KyriosStems - js/firebase/config.js
 * Configuração do Firebase, usada APENAS pela tela temporária de cadastro.
 *
 * ---------------------------------------------------------------------------
 * TELA TEMPORÁRIA
 *
 * Esta tela existe para criar a conta de administrador e depois deve ser
 * REMOVIDA. Ela não é a arquitetura do projeto: a biblioteca continua sendo
 * lida do Google Drive, sem login. Veja "Remover a tela temporária" no README.
 *
 * POR QUE A SENHA NÃO É GRAVADA POR NÓS
 *
 * O pedido era gravar e-mail e senha em um banco, com a senha criptografada.
 * A aplicação é estática e o repositório é PÚBLICO: qualquer coisa que o
 * navegador grave fica visível para qualquer visitante. Uma tabela de senhas
 * ali seria lida por qualquer pessoa, mesmo com hash — e um hash de senha
 * pública é um alvo para quebra offline.
 *
 * Por isso a senha vai para o Firebase Authentication, que:
 *   - guarda apenas o hash, com salt, num serviço próprio (nunca no navegador);
 *   - nunca devolve a senha de volta, nem para nós;
 *   - recusa senhas fracas e trata tentativas repetidas.
 *
 * O e-mail é gravado no Firestore para que a tela liste quem foi cadastrado.
 * NUNCA grave senha, hash ou token lá.
 * ---------------------------------------------------------------------------
 *
 * Estes valores são PÚBLICOS por natureza: o SDK Web é embarcado no navegador.
 * Quem protege são as Security Rules do Firestore e a restrição de domínio na
 * chave de API.
 */

export const firebaseConfig = {
  apiKey: 'COLE_AQUI_A_API_KEY',
  authDomain: 'COLE_AQUI.firebaseapp.com',
  projectId: 'COLE_AQUI',
  appId: 'COLE_AQUI',
};

/** Versão do Firebase Web SDK (ES Modules via CDN). */
export const FIREBASE_SDK_VERSION = '10.14.1';

/**
 * Coleção do Firestore onde os e-mails cadastrados são registrados.
 * Apenas e-mail e data. Nunca senha.
 */
export const REGISTRATIONS_COLLECTION = 'cadastros';

/**
 * Indica se a configuração foi preenchida com valores reais.
 * Enquanto não estiver, a tela avisa o que falta em vez de falhar sem explicação.
 */
export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(
    (value) => typeof value === 'string' && value.length > 0 && !value.startsWith('COLE_AQUI'),
  );
}

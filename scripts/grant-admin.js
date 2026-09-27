/**
 * KyriosStems - concede ou revoga o acesso administrativo.
 *
 * O acesso é controlado por uma custom claim no token do usuário. A claim não
 * pode ser definida pelo SDK Web, por isso este script usa o SDK Admin.
 *
 * Preparo:
 *   1. Gere uma chave de serviço no console do Firebase:
 *      Configurações do projeto > Contas de serviço > Gerar nova chave privada
 *   2. Salve como serviceAccount.json na raiz do projeto
 *      (o .gitignore já impede o versionamento desse arquivo)
 *
 * Uso:
 *   node scripts/grant-admin.js seu@email.com
 *   node scripts/grant-admin.js seu@email.com --revoke
 *
 * A variável GOOGLE_APPLICATION_CREDENTIALS também é aceita:
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave.json node scripts/grant-admin.js seu@email.com
 *
 * Depois de alterar a claim, o usuário precisa entrar novamente: o token em uso
 * ainda carrega as claims antigas até ser renovado.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.resolve(__dirname, '..');
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccount.json');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const [email, ...flags] = process.argv.slice(2);
  const revoke = flags.includes('--revoke');

  if (!email || email.startsWith('--')) {
    fail('Informe o e-mail do usuário.\n\n  node scripts/grant-admin.js seu@email.com');
  }

  if (!admin.apps.length) {
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (credentials) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else if (fs.existsSync(SERVICE_ACCOUNT)) {
      admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
    } else {
      fail(
        'Credenciais não encontradas.\n\n' +
          'Gere uma chave de serviço no console do Firebase e salve como\n' +
          `  ${path.relative(process.cwd(), SERVICE_ACCOUNT)}\n\n` +
          'Ou defina GOOGLE_APPLICATION_CREDENTIALS apontando para a chave.',
      );
    }
  }

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      fail(
        `Nenhum usuário com o e-mail ${email}.\n\n` +
          'Crie o usuário em Authentication > Users antes de conceder a claim.',
      );
    }
    fail(`Falha ao consultar o usuário: ${error.message}`);
  }

  const claims = { ...(user.customClaims || {}), admin: !revoke };
  if (revoke) delete claims.admin;

  await admin.auth().setCustomUserClaims(user.uid, claims);

  // Relê o usuário para confirmar que a claim foi aplicada de fato.
  const updated = await admin.auth().getUser(user.uid);
  const applied = updated.customClaims?.admin === true;

  console.log(`\nUsuário: ${email}`);
  console.log(`UID:     ${user.uid}`);

  if (revoke) {
    if (applied) fail('A claim não foi removida. Verifique as permissões da conta de serviço.');
    console.log('Acesso:  revogado');
  } else {
    if (!applied) fail('A claim não foi aplicada. Verifique as permissões da conta de serviço.');
    console.log('Acesso:  administrador');
  }

  console.log('\nO usuário precisa entrar novamente para o token ser renovado.\n');
}

main().catch((error) => fail(`Erro inesperado: ${error.message}`));
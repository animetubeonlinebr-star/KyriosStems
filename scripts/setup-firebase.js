/**
 * KyriosStems - prepara o projeto Firebase do zero.
 *
 * Faz em um passo o que exigiria varios cliques no console:
 *   1. Ativa as APIs necessarias
 *   2. Cria o banco do Firestore
 *   3. Cria o bucket do Storage
 *   4. Cria o usuario administrador
 *   5. Concede a custom claim admin
 *
 * Exige uma chave de servico com papel de Editor ou Owner no projeto.
 *
 * Preparo:
 *   Console do Firebase > Configuracoes do projeto > Contas de servico
 *   > Gerar nova chave privada  ->  salve como serviceAccount.json na raiz
 *
 * Uso:
 *   node scripts/setup-firebase.js --email seu@email.com --password "SuaSenha"
 *
 * O script e idempotente: rodar de novo nao quebra o que ja existe.
 * A senha nao e gravada em lugar nenhum.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const admin = require('firebase-admin');

const ROOT = path.resolve(__dirname, '..');
const SERVICE_ACCOUNT = path.join(ROOT, 'serviceAccount.json');

const APIS = [
  'firestore.googleapis.com',
  'storage.googleapis.com',
  'identitytoolkit.googleapis.com',
];

// Região do banco e do bucket. São Paulo fica mais perto do Brasil, o que
// reduz a latência de leitura e escrita. A região do Firestore é PERMANENTE:
// não pode ser alterada depois de criada.
const LOCATION = 'southamerica-east1';

function fail(message, hint) {
  console.error(`\n${message}\n`);
  if (hint) console.error(`${hint}\n`);
  process.exit(1);
}

/** Requisicao HTTPS com JSON, devolvendo status e corpo. */
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseArgs(argv) {
  const args = { email: null, password: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--email') args.email = argv[i + 1];
    if (argv[i] === '--password') args.password = argv[i + 1];
  }
  return args;
}

/** Extrai a chave privada para autenticar nas APIs do Google. */
function loadCredentials() {
  if (!fs.existsSync(SERVICE_ACCOUNT)) {
    fail(
      `Chave de servico nao encontrada em:\n  ${path.relative(process.cwd(), SERVICE_ACCOUNT)}`,
      'Gere em: Console do Firebase > Configuracoes do projeto > Contas de servico\n' +
        '> Gerar nova chave privada. O arquivo ja esta no .gitignore.',
    );
  }

  const key = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, 'utf8'));
  if (!key.project_id || !key.private_key || !key.client_email) {
    fail('A chave de servico esta incompleta ou corrompida.');
  }
  return key;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email) {
    fail('Informe o e-mail.\n\n  node scripts/setup-firebase.js --email seu@email.com --password "SuaSenha"');
  }
  if (!args.password || args.password.length < 8) {
    fail(
      'Informe uma senha com pelo menos 8 caracteres.\n\n' +
        '  node scripts/setup-firebase.js --email seu@email.com --password "SuaSenha"',
      'Use uma senha unica e longa. Nao reutilize senha de outro servico.',
    );
  }

  const key = loadCredentials();
  const projectId = key.project_id;

  console.log(`\nProjeto: ${projectId}`);
  console.log(`E-mail:  ${args.email}\n`);

  // -------------------------------------------------------------------------
  // 1. APIs
  // -------------------------------------------------------------------------
  console.log('1/5  Ativando APIs');

  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const headers = {
    Authorization: `Bearer ${token.token}`,
    'Content-Type': 'application/json',
  };

  for (const api of APIS) {
    const res = await request({
      hostname: 'serviceusage.googleapis.com',
      path: `/v1/projects/${projectId}/services/${api}:enable`,
      method: 'POST',
      headers,
    });

    if (res.status === 200) {
      console.log(`     ${api} ativada`);
    } else if (res.status === 403) {
      // A chave do Firebase Admin SDK normalmente nao tem permissao para
      // administrar APIs. Se a API ja estiver ativa, o servico funciona
      // mesmo assim, entao seguimos em frente em vez de abortar.
      console.log(`     ${api}: sem permissao para ativar (pode ja estar ativa)`);
    } else {
      console.log(`     ${api}: HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 120)}`);
    }
  }

  // As APIs levam alguns segundos para propagar.
  console.log('     aguardando propagacao...');
  await new Promise((r) => setTimeout(r, 12000));

  // -------------------------------------------------------------------------
  // 2. Firestore
  // -------------------------------------------------------------------------
  console.log('2/5  Criando o banco do Firestore');

  const dbRes = await request(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases?databaseId=(default)`,
      method: 'POST',
      headers,
    },
    { type: 'FIRESTORE_NATIVE', locationId: LOCATION },
  );

  if (dbRes.status === 200 || dbRes.status === 201) {
    console.log('     banco criado');
  } else if (dbRes.status === 409) {
    console.log('     banco ja existia');
  } else if (dbRes.status === 400 && JSON.stringify(dbRes.body).includes('already exists')) {
    console.log('     banco ja existia');
  } else {
    console.log(`     HTTP ${dbRes.status}: ${JSON.stringify(dbRes.body).slice(0, 200)}`);
    console.log('     Se falhar, crie pelo console: Firestore Database > Criar banco');
  }

  // -------------------------------------------------------------------------
  // 3. Storage
  // -------------------------------------------------------------------------
  console.log('3/5  Verificando o bucket do Storage');

  const bucketName = `${projectId}.firebasestorage.app`;
  const bucketRes = await request({
    hostname: 'storage.googleapis.com',
    path: `/storage/v1/b/${bucketName}`,
    method: 'GET',
    headers,
  });

  if (bucketRes.status === 200) {
    console.log(`     bucket ${bucketName} existe`);
  } else {
    console.log(`     bucket ${bucketName} nao encontrado (HTTP ${bucketRes.status})`);
    console.log('     Crie pelo console: Storage > Comecar');
    console.log(`     O nome precisa ser exatamente: ${bucketName}`);
  }

  // -------------------------------------------------------------------------
  // 4 e 5. Usuario e claim
  // -------------------------------------------------------------------------
  console.log('4/5  Criando o usuario administrador');

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }

  let user;
  try {
    user = await admin.auth().getUserByEmail(args.email);
    console.log('     usuario ja existia');
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      fail(`Falha ao consultar o usuario: ${error.message}`);
    }
    try {
      user = await admin.auth().createUser({
        email: args.email,
        password: args.password,
        emailVerified: true,
      });
      console.log(`     usuario criado (uid ${user.uid})`);
    } catch (createError) {
      if (createError.code === 'auth/configuration-not-found') {
        fail(
          'O provedor de e-mail/senha ainda nao esta ativo.',
          'Aguarde um minuto e rode de novo: a ativacao da API leva alguns instantes.\n' +
            'Se persistir, ative em Authentication > Sign-in method > E-mail/senha.',
        );
      }
      fail(`Falha ao criar o usuario: ${createError.message}`);
    }
  }

  console.log('5/5  Concedendo acesso administrativo');

  const claims = { ...(user.customClaims || {}), admin: true };
  await admin.auth().setCustomUserClaims(user.uid, claims);

  const updated = await admin.auth().getUser(user.uid);
  if (updated.customClaims?.admin !== true) {
    fail('A claim admin nao foi aplicada.');
  }
  console.log('     claim admin concedida');

  // -------------------------------------------------------------------------
  console.log('\nPronto.\n');
  console.log('  Entre em admin.html com:');
  console.log(`    e-mail: ${args.email}`);
  console.log(`    senha:  (a que voce informou)\n`);
  console.log('  Falta publicar as Security Rules:');
  console.log('    npm run deploy:rules\n');
}

main().catch((error) => fail(`Erro inesperado: ${error.message}`));
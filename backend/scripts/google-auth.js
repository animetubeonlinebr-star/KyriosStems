/**
 * KyriosStems - backend/scripts/google-auth.js
 * Obtém o refresh token da conta Google dedicada ao KyriosStems.
 *
 * Por que isto existe: uma conta de serviço não é dona de pasta no "Meu Drive"
 * de uma conta comum, e o backend precisa de uma identidade com acesso à pasta
 * da biblioteca. A alternativa é autorizar uma vez a conta dedicada e guardar o
 * refresh token — a partir daí o backend renova o acesso sozinho, sem
 * intervenção humana.
 *
 * Pré-requisitos no Google Cloud Console:
 *   1. Google Drive API ativada
 *   2. Credencial OAuth do tipo "App para computador" (Desktop app)
 *      O tipo importa: apps desktop redirecionam para localhost e não exigem
 *      cadastro prévio da URI. Um cliente do tipo "Web" exigiria cadastrar a
 *      URI de redirecionamento antes de funcionar.
 *
 * Uso:
 *   node scripts/google-auth.js
 *
 * O script sobe um servidor local, mostra a URL de consentimento, recebe o
 * código e troca por um refresh token. Nenhuma senha da conta Google é pedida:
 * a autenticação acontece na própria página do Google.
 */

import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, '..', '.env');

const SCOPE = 'https://www.googleapis.com/auth/drive';

/* -------------------------------------------------------------------------- */
/* Apoio                                                                       */
/* -------------------------------------------------------------------------- */

/** Lê backend/.env no formato CHAVE=valor, preservando comentários e ordem. */
function readEnvFile() {
  if (!existsSync(ENV_FILE)) return { lines: [], values: {} };

  const lines = readFileSync(ENV_FILE, 'utf8').split('\n');
  const values = {};

  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }

  return { lines, values };
}

/** Grava um valor no .env, substituindo a linha existente. */
function writeEnvValue(key, value) {
  const { lines } = readEnvFile();
  const pattern = new RegExp(`^${key}=`);
  const index = lines.findIndex((line) => pattern.test(line));
  const entry = `${key}=${value}`;

  if (index >= 0) lines[index] = entry;
  else lines.push(entry);

  writeFileSync(ENV_FILE, lines.join('\n'), 'utf8');
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Abre a URL de consentimento no navegador, se possível. */
async function openBrowser(url) {
  try {
    const { spawn } = await import('node:child_process');
    const command = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'start'
      : 'xdg-open';
    spawn(command, [url], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // Sem navegador disponível: a URL já foi exibida para cópia manual.
  }
}

/* -------------------------------------------------------------------------- */
/* Fluxo                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const { values } = readEnvFile();
  const clientId = process.env.KYRIOS_DRIVE_CLIENT_ID || values.KYRIOS_DRIVE_CLIENT_ID;
  const clientSecret = process.env.KYRIOS_DRIVE_CLIENT_SECRET || values.KYRIOS_DRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Defina KYRIOS_DRIVE_CLIENT_ID e KYRIOS_DRIVE_CLIENT_SECRET em backend/.env');
    console.error('Credenciais: Google Cloud Console > APIs e serviços > Credenciais');
    console.error('Crie uma credencial OAuth do tipo "App para computador".');
    process.exit(1);
  }

  // Porta de redirecionamento em loopback. Apps desktop aceitam qualquer porta
  // local sem cadastro prévio; usa-se uma fixa para previsibilidade.
  const port = 8765;
  const redirectUri = `http://localhost:${port}`;

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  // `offline` é o que devolve o refresh token; `consent` força a tela de
  // permissão mesmo quando já houve autorização, garantindo um token novo.
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\nAutorização da conta dedicada do KyriosStems\n');
  console.log('Entre com a conta Google DEDICADA (não a pessoal).');
  console.log('Se aparecer a tela de app não verificado, use "Avançado" > "Acessar".\n');
  console.log('URL de consentimento:\n');
  console.log(`  ${authUrl}\n`);

  await openBrowser(authUrl.toString());

  /* --- Servidor local que recebe o código --------------------------------- */

  const code = await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, redirectUri);
      const received = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

      if (error) {
        response.end(`<h1>Autorização recusada</h1><p>${error}</p><p>Feche esta aba.</p>`);
        server.close();
        reject(new Error(`O Google recusou a autorização: ${error}`));
        return;
      }

      response.end('<h1>Tudo certo</h1><p>Pode fechar esta aba e voltar ao terminal.</p>');
      server.close();
      resolve(received);
    });

    server.on('error', (error) => {
      reject(new Error(
        `Não foi possível abrir a porta ${port} para receber a resposta do Google (${error.code}).\n`
        + 'Feche o programa que estiver usando essa porta e tente de novo.',
      ));
    });

    server.listen(port, () => {
      console.log(`Aguardando a resposta do Google em ${redirectUri} ...`);
      console.log('Se o navegador não abrir, copie a URL acima e cole no navegador.\n');
    });
  });

  if (!code) {
    console.error('Nenhum código foi recebido.');
    process.exit(1);
  }

  /* --- Troca do código pelo refresh token --------------------------------- */

  console.log('Código recebido. Trocando por refresh token...');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('\nFalha ao trocar o código:', data.error_description || data.error);
    if (data.error === 'redirect_uri_mismatch') {
      console.error('\nA credencial não é do tipo "App para computador".');
      console.error('Crie outra do tipo Desktop app e atualize o client_id no .env.');
    }
    process.exit(1);
  }

  if (!data.refresh_token) {
    console.error('\nO Google não devolveu refresh token.');
    console.error('Isso acontece quando a conta já autorizou antes. Remova o acesso em');
    console.error('myaccount.google.com > Segurança > Apps de terceiros e tente de novo.');
    process.exit(1);
  }

  writeEnvValue('KYRIOS_DRIVE_REFRESH_TOKEN', data.refresh_token);

  console.log('\nRefresh token gravado em backend/.env');
  console.log('O arquivo .env não é versionado.');

  /* --- Pasta raiz --------------------------------------------------------- */

  const folderInput = await ask(
    '\nCole a URL ou o ID da pasta do KyriosStems no Drive (Enter para pular): ',
  );

  if (folderInput) {
    // Aceita tanto o ID puro quanto a URL completa do Drive.
    const match = folderInput.match(/[-\w]{25,}/);
    const folderId = match ? match[0] : folderInput;

    writeEnvValue('KYRIOS_DRIVE_FOLDER_ID', folderId);
    console.log(`\nPasta raiz gravada: ${folderId}`);
    console.log('Compartilhe essa pasta com a conta dedicada com papel de Editor.');
  }

  console.log('\nPróximo passo: npm run drive:check\n');
}

main().catch((error) => {
  console.error('\nFalha:', error.message);
  process.exit(1);
});

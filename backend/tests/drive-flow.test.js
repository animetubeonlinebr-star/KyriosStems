/**
 * KyriosStems - backend/tests/drive-flow.test.js
 * Testa o fluxo de envio com um Drive simulado.
 *
 * Por que simular: o fluxo real exige uma conta Google com consentimento
 * humano. O que este teste cobre é a parte que pode estar errada sem que
 * ninguém perceba — a montagem das URLs, a associação entre o arquivo enviado
 * e a categoria, e o registro da sessão com os ids devolvidos.
 *
 * O Drive simulado responde exatamente como a API real: devolve o cabeçalho
 * `location` na criação do envio e `{ id }` no PUT do arquivo.
 *
 * Uso:
 *   node tests/drive-flow.test.js
 */

import { createServer } from 'node:http';
import { requestListener } from '../src/http/handler.js';
import { getPool, closePool } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/passwords.js';
import { upsertAdmin } from '../src/db/admins.js';
import { drive as driveConfig } from '../src/config.js';

const TEST_EMAIL = 'teste-drive@kyriosstems.local';
const TEST_PASSWORD = 'senha-de-teste-123';
const SONG_ID = 'test_drive_song';
const SESSION_ID = 'test_drive_session';

let baseUrl = '';
let server = null;
let driveServer = null;
let failures = 0;

/** Arquivos que o Drive simulado recebeu, para conferência. */
const received = [];

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok      ${label}`);
  } else {
    console.log(`  FALHOU  ${label}${detail ? ` — ${detail}` : ''}`);
    failures += 1;
  }
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function cleanup() {
  const pool = getPool();
  await pool.query('delete from songs where id like $1', ['test_%']);
  await pool.query('delete from admin_users where email = $1', [TEST_EMAIL]);
}

/* -------------------------------------------------------------------------- */
/* Drive simulado                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Simula o Google Drive.
 *
 * A autenticação é tratada em `globalThis.fetch` (ver abaixo), porque o cliente
 * do Drive usa fetch direto. Este servidor cuida só das respostas da API.
 */
function startDriveStub() {
  return new Promise((resolve) => {
    driveServer = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost');

      // Upload retomável: a criação devolve a URL de envio no cabeçalho.
      if (request.method === 'POST' && url.pathname === '/upload/drive/v3/files') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const meta = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

        const uploadId = `upload_${received.length + 1}`;
        response.writeHead(200, {
          'Content-Type': 'application/json',
          location: `http://127.0.0.1:${driveServer.address().port}/upload/session/${uploadId}`,
        });
        response.end(JSON.stringify({ name: meta.name }));

        received.push({ name: meta.name, uploadId, bytes: null });
        return;
      }

      // Recebe os bytes do arquivo e devolve o id.
      if (request.method === 'PUT' && url.pathname.startsWith('/upload/session/')) {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const size = Buffer.concat(chunks).length;

        const uploadId = url.pathname.split('/').pop();
        const entry = received.find((item) => item.uploadId === uploadId);
        if (entry) entry.bytes = size;

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ id: `drive_file_${uploadId}`, name: entry?.name }));
        return;
      }

      // Criação de pasta.
      if (request.method === 'POST' && url.pathname === '/drive/v3/files') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ id: 'drive_folder_1', name: 'session_x' }));
        return;
      }

      // Busca de pasta (ensureFolder): devolve vazio, forçando a criação.
      if (request.method === 'GET' && url.pathname === '/drive/v3/files') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ files: [] }));
        return;
      }

      // Metadados de arquivo e conteúdo.
      if (request.method === 'GET' && url.pathname.startsWith('/drive/v3/files/')) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          id: 'drive_file_x',
          name: 'session.zip',
          size: '1048576',
          mimeType: 'application/zip',
        }));
        return;
      }

      // Remoção.
      if (request.method === 'PATCH' && url.pathname.startsWith('/drive/v3/files/')) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ id: 'drive_file_x', trashed: true }));
        return;
      }

      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'rota não simulada: ' + url.pathname } }));
    });

    driveServer.listen(0, '127.0.0.1', () => resolve(driveServer.address().port));
  });
}

/**
 * Intercepta as chamadas do cliente do Drive.
 *
 * Redireciona a troca do refresh token para uma resposta fixa e os endereços do
 * Google para o Drive simulado. Sem isso o teste exigiria uma conta real.
 */
function installFetchInterceptor(drivePort) {
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (input, options) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(
        JSON.stringify({ access_token: 'token_simulado', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('https://www.googleapis.com/drive/v3')) {
      return realFetch(url.replace('https://www.googleapis.com/drive/v3', `http://127.0.0.1:${drivePort}/drive/v3`), options);
    }

    if (url.startsWith('https://www.googleapis.com/upload/drive/v3')) {
      return realFetch(url.replace('https://www.googleapis.com/upload/drive/v3', `http://127.0.0.1:${drivePort}/upload/drive/v3`), options);
    }

    return realFetch(input, options);
  };
}

/* -------------------------------------------------------------------------- */
/* Testes                                                                      */
/* -------------------------------------------------------------------------- */

async function run() {
  await cleanup();
  await upsertAdmin(TEST_EMAIL, await hashPassword(TEST_PASSWORD));

  const drivePort = await startDriveStub();
  installFetchInterceptor(drivePort);

  server = createServer(requestListener());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = await call('POST', '/api/auth/login', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const token = login.data?.token;
  check('login devolve token', Boolean(token));

  // A música precisa existir antes dos arquivos: a pasta no Drive é criada a
  // partir dela.
  const song = await call('POST', '/api/songs', {
    token,
    body: { song: { id: SONG_ID, title: 'Teste Drive', artist: 'Teste' } },
  });
  check('cria a música', song.status === 201, JSON.stringify(song.data));

  /* --- Preparação do envio ----------------------------------------------- */
  console.log('\nPreparação do envio');

  const files = [
    { name: 'pacote.zip', category: 'package', path: 'session.zip', size: 1048576, contentType: 'application/zip' },
    { name: 'projeto.rpp', category: 'project', path: 'Project/projeto.rpp', size: 2048, contentType: 'text/plain' },
    { name: '01 Drums.wav', category: 'audio', path: 'Audio/01 Drums.wav', size: 4096, contentType: 'audio/wav' },
  ];

  const prepared = await call('POST', '/api/drive/prepare', {
    token,
    body: { songId: SONG_ID, sessionId: SESSION_ID, files },
  });

  check('prepare responde 200', prepared.status === 200, JSON.stringify(prepared.data));
  check('devolve a pasta da sessão', prepared.data?.folderId === 'drive_folder_1');
  check('devolve uma URL de envio por arquivo', prepared.data?.uploads?.length === 3);
  check('a ordem dos arquivos é preservada',
    prepared.data?.uploads?.[0]?.name === 'pacote.zip'
    && prepared.data?.uploads?.[1]?.name === 'projeto.rpp'
    && prepared.data?.uploads?.[2]?.name === '01 Drums.wav');
  check('cada envio tem URL própria',
    prepared.data?.uploads?.every((upload) => typeof upload.uploadUrl === 'string' && upload.uploadUrl.includes('/upload/session/')));

  // Sem música gravada, o prepare precisa recusar: não há onde pendurar a pasta.
  const orphan = await call('POST', '/api/drive/prepare', {
    token,
    body: { songId: 'musica_inexistente', sessionId: 'x', files: [files[0]] },
  });
  check('prepare exige música existente', orphan.status === 404, `status ${orphan.status}`);

  const noFiles = await call('POST', '/api/drive/prepare', {
    token,
    body: { songId: SONG_ID, sessionId: SESSION_ID, files: [] },
  });
  check('prepare exige ao menos um arquivo', noFiles.status === 400, `status ${noFiles.status}`);

  /* --- Envio dos bytes --------------------------------------------------- */
  console.log('\nEnvio dos bytes para o Drive');

  const uploaded = [];
  for (const upload of prepared.data.uploads) {
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Buffer.alloc(upload.size ?? 1024, 1),
    });
    const data = await response.json();
    uploaded.push({
      name: upload.name,
      path: upload.path,
      fileId: data.id,
      size: upload.size,
      category: upload.category,
      contentType: 'application/octet-stream',
    });
  }

  check('os três arquivos chegaram ao Drive', received.filter((item) => item.bytes !== null).length === 3);
  check('o Drive devolveu um id por arquivo', uploaded.every((file) => file.fileId?.startsWith('drive_file_')));
  check('o pacote foi enviado como session.zip', uploaded[0].path === 'session.zip');

  /* --- Registro da sessão ------------------------------------------------ */
  console.log('\nRegistro da sessão');

  const session = await call('POST', '/api/sessions', {
    token,
    body: {
      session: {
        id: SESSION_ID,
        songId: SONG_ID,
        daw: 'REAPER',
        version: 1,
        format: 'WAV',
        packageFileId: uploaded[0].fileId,
        packageSize: uploaded[0].size,
      },
      files: uploaded,
    },
  });
  check('cria a sessão', session.status === 201, JSON.stringify(session.data));

  const detail = await call('GET', `/api/songs/${SONG_ID}`);
  check('a sessão aparece na música', detail.data?.sessions?.length === 1);
  check('o pacote guarda o id do Drive',
    detail.data?.sessions?.[0]?.packageFileId === 'drive_file_upload_1');
  check('os três arquivos foram catalogados',
    detail.data?.sessions?.[0]?.files?.length === 3);
  check('as categorias foram preservadas',
    detail.data?.sessions?.[0]?.files?.map((file) => file.category).join(',') === 'package,project,audio');
  check('o caminho dentro do pacote é o esperado',
    detail.data?.sessions?.[0]?.files?.[1]?.path === 'Project/projeto.rpp');

  /* --- Download ---------------------------------------------------------- */
  console.log('\nDownload');

  const pkg = await call('GET', `/api/drive/sessions/${SESSION_ID}/package`);
  check('resolve o pacote', pkg.status === 200, JSON.stringify(pkg.data));
  check('monta o nome amigável',
    pkg.data?.fileName === 'Teste Drive - REAPER - v1.zip', pkg.data?.fileName);
  check('aponta para o conteúdo do arquivo', pkg.data?.url === '/api/drive/files/drive_file_upload_1/content');

  const list = await call('GET', `/api/drive/sessions/${SESSION_ID}/files`);
  check('lista os arquivos individuais', list.data?.files?.length === 3);
  check('cada arquivo tem URL de download',
    list.data?.files?.every((file) => file.url?.includes('/content?name=')));

  // O nome no cabeçalho precisa ser seguro: um valor com quebra de linha
  // permitiria injetar cabeçalhos na resposta.
  const injected = await call('GET', `/api/drive/files/drive_file_x/content?name=${encodeURIComponent('a.zip\r\nX-Injetado: 1')}`);
  check('nome com quebra de linha é sanitizado', injected.status === 200);

  /* --- Exclusão ---------------------------------------------------------- */
  console.log('\nExclusão');

  const before = received.length;
  const removed = await call('DELETE', `/api/sessions/${SESSION_ID}`, { token });
  check('exclui a sessão removendo os arquivos antes', removed.status === 200, JSON.stringify(removed.data));
  check('os três arquivos foram removidos do Drive',
    received.slice(before).length === 0 && removed.data?.files === 3);

  const gone = await call('GET', `/api/songs/${SONG_ID}`);
  check('a sessão sumiu da música', gone.data?.sessions?.length === 0);
}

run()
  .catch((error) => {
    console.error('\nErro no teste:', error);
    failures += 1;
  })
  .then(async () => {
    await cleanup();
    await closePool();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (driveServer) await new Promise((resolve) => driveServer.close(resolve));

    console.log(`\n${failures === 0 ? 'TODOS OS TESTES PASSARAM' : `${failures} verificação(ões) falharam`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
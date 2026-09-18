/**
 * KyriosStems - backend/tests/api.test.js
 * Teste de integração da API.
 *
 * Exercita o caminho real: HTTP -> roteador -> autorização -> banco. Não usa
 * mocks: o valor de um teste aqui é justamente confirmar que as camadas se
 * entendem e que as restrições do banco estão no lugar.
 *
 * Os dados criados são removidos no fim. Os arquivos no Drive não são tocados:
 * o teste cobre metadados, autenticação e autorização.
 *
 * Uso:
 *   node tests/api.test.js
 */

import { createServer } from 'node:http';
import { requestListener } from '../src/http/handler.js';
import { getPool, closePool } from '../src/db/pool.js';
import { hashPassword } from '../src/auth/passwords.js';
import { upsertAdmin } from '../src/db/admins.js';

const TEST_EMAIL = 'teste-integracao@kyriosstems.local';
const TEST_PASSWORD = 'senha-de-teste-123';
const SONG_ID = 'test_song_integration';
const SESSION_ID = 'test_session_integration';

let baseUrl = '';
let server = null;
let failures = 0;

/* -------------------------------------------------------------------------- */
/* Apoio                                                                       */
/* -------------------------------------------------------------------------- */

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

/** Remove tudo que o teste possa ter deixado. */
async function cleanup() {
  const pool = getPool();
  await pool.query('delete from songs where id like $1', ['test_%']);
  await pool.query('delete from admin_users where email = $1', [TEST_EMAIL]);
}

/* -------------------------------------------------------------------------- */
/* Testes                                                                      */
/* -------------------------------------------------------------------------- */

async function run() {
  await cleanup();
  await upsertAdmin(TEST_EMAIL, await hashPassword(TEST_PASSWORD));

  server = createServer(requestListener());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  /* --- Saúde ------------------------------------------------------------- */
  console.log('\nSaúde e catálogo');
  const health = await call('GET', '/api/health');
  check('health responde 200', health.status === 200, `status ${health.status}`);
  check('health identifica o banco', health.data?.database?.name === 'defaultdb');

  const library = await call('GET', '/api/library');
  check('catálogo é público', library.status === 200);
  check('catálogo devolve songs e sessions',
    Array.isArray(library.data?.songs) && Array.isArray(library.data?.sessions));

  /* --- Autorização ------------------------------------------------------- */
  console.log('\nAutorização');
  const noToken = await call('POST', '/api/songs', { body: { song: { id: 'x', title: 'T', artist: 'A' } } });
  check('escrita sem token é recusada', noToken.status === 401, `status ${noToken.status}`);

  const badToken = await call('POST', '/api/songs', {
    token: 'nao.e.valido',
    body: { song: { id: 'x', title: 'T', artist: 'A' } },
  });
  check('token forjado é recusado', badToken.status === 401, `status ${badToken.status}`);

  const wrongLogin = await call('POST', '/api/auth/login', {
    body: { email: TEST_EMAIL, password: 'senha-errada' },
  });
  check('login com senha errada é recusado', wrongLogin.status === 401, `status ${wrongLogin.status}`);

  const login = await call('POST', '/api/auth/login', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  check('login válido devolve token', login.status === 200 && Boolean(login.data?.token));

  const token = login.data?.token;

  const me = await call('GET', '/api/auth/me', { token });
  check('token identifica o administrador', me.status === 200 && me.data?.user?.email === TEST_EMAIL);

  /* --- Músicas ----------------------------------------------------------- */
  console.log('\nMúsicas');
  const created = await call('POST', '/api/songs', {
    token,
    body: {
      song: {
        id: SONG_ID,
        title: 'Vim Para Adorar-te',
        artist: 'Adoração e Adoradores',
        key: 'E',
        bpm: 72,
        timeSignature: '4/4',
        category: 'Louvor',
        tags: ['adoração', 'lento'],
      },
    },
  });
  check('cria música', created.status === 201, JSON.stringify(created.data));
  check('devolve bpm como número', created.data?.song?.bpm === 72);
  check('devolve tags como lista', Array.isArray(created.data?.song?.tags));
  check('devolve createdAt em ISO 8601',
    /^\d{4}-\d{2}-\d{2}T/.test(created.data?.song?.createdAt || ''));

  const fetched = await call('GET', `/api/songs/${SONG_ID}`);
  check('lê a música pelo id', fetched.status === 200 && fetched.data?.song?.title === 'Vim Para Adorar-te');

  const patched = await call('PATCH', `/api/songs/${SONG_ID}`, {
    token,
    body: { category: 'Adoração' },
  });
  check('atualiza campo isolado', patched.status === 200 && patched.data?.song?.category === 'Adoração');
  check('atualização preserva os demais campos',
    patched.data?.song?.bpm === 72 && patched.data?.song?.title === 'Vim Para Adorar-te');

  /* --- Restrições do banco via API --------------------------------------- */
  console.log('\nValidação de conteúdo pela API');
  const badBpm = await call('POST', '/api/songs', {
    token,
    body: { song: { id: 'test_bad_bpm', title: 'T', artist: 'A', bpm: 999 } },
  });
  check('BPM fora da faixa é recusado', badBpm.status === 400, `status ${badBpm.status}`);

  const emptyTitle = await call('POST', '/api/songs', {
    token,
    body: { song: { id: 'test_empty_title', title: '', artist: 'A' } },
  });
  check('título vazio é recusado', emptyTitle.status === 400, `status ${emptyTitle.status}`);

  /* --- Sessões ----------------------------------------------------------- */
  console.log('\nSessões');
  const nextVersion = await call('GET', `/api/songs/${SONG_ID}/next-version?daw=REAPER`, { token });
  check('próxima versão começa em 1', nextVersion.data?.version === 1);

  const session = await call('POST', '/api/sessions', {
    token,
    body: {
      session: {
        id: SESSION_ID,
        songId: SONG_ID,
        daw: 'REAPER',
        dawVersion: '7.x',
        version: 1,
        format: 'WAV',
        sampleRate: 48000,
        bitDepth: 24,
        packageFileId: 'drive_file_fake',
        packageSize: 1048576,
      },
      files: [
        { name: 'session.zip', path: 'session.zip', fileId: 'drive_zip', size: 1048576, category: 'package' },
        { name: '01 Drums.wav', path: 'Audio/01 Drums.wav', fileId: 'drive_wav', size: 2048, category: 'audio' },
      ],
    },
  });
  check('cria sessão com arquivos', session.status === 201, JSON.stringify(session.data));

  const songWithSessions = await call('GET', `/api/songs/${SONG_ID}`);
  check('sessão aparece na música', songWithSessions.data?.sessions?.length === 1);
  check('arquivos da sessão são devolvidos', songWithSessions.data?.sessions?.[0]?.files?.length === 2);
  check('arquivo expõe fileId do Drive',
    songWithSessions.data?.sessions?.[0]?.files?.[0]?.fileId?.startsWith('drive_'));

  const dupVersion = await call('POST', '/api/sessions', {
    token,
    body: {
      session: { id: 'test_dup', songId: SONG_ID, daw: 'REAPER', version: 1 },
    },
  });
  check('versão duplicada da mesma DAW é recusada', dupVersion.status === 409, `status ${dupVersion.status}`);

  const orphan = await call('POST', '/api/sessions', {
    token,
    body: { session: { id: 'test_orphan', songId: 'musica_inexistente', daw: 'REAPER', version: 1 } },
  });
  check('sessão de música inexistente é recusada', orphan.status === 400, `status ${orphan.status}`);

  const secondVersion = await call('GET', `/api/songs/${SONG_ID}/next-version?daw=REAPER`, { token });
  check('próxima versão avança para 2', secondVersion.data?.version === 2);

  /* --- Exclusão ---------------------------------------------------------- */
  console.log('\nExclusão');

  // Sessão com arquivos no Drive: a exclusão DEVE ser recusada quando o Drive
  // não responde. Remover o registro antes dos arquivos deixaria arquivos
  // órfãos ocupando cota, sem referência para encontrá-los depois.
  const refused = await call('DELETE', `/api/sessions/${SESSION_ID}`, { token });
  check('exclusão é recusada quando o Drive falha', refused.status === 502, `status ${refused.status}`);

  const stillThere = await call('GET', `/api/songs/${SONG_ID}`);
  check('sessão permanece após a recusa', stillThere.data?.sessions?.length === 1);

  // Sessão sem arquivos: não há o que remover no Drive, então a exclusão passa.
  const emptySession = await call('POST', '/api/sessions', {
    token,
    body: {
      session: { id: 'test_empty_session', songId: SONG_ID, daw: 'Ableton Live', version: 1 },
    },
  });
  check('cria sessão sem arquivos', emptySession.status === 201, JSON.stringify(emptySession.data));

  const emptyDelete = await call('DELETE', '/api/sessions/test_empty_session', { token });
  check('exclui sessão sem arquivos', emptyDelete.status === 200, JSON.stringify(emptyDelete.data));

  // A exclusão em cascata precisa levar os arquivos junto: sem isso, sobrariam
  // linhas em session_files apontando para uma sessão que não existe mais.
  await getPool().query('delete from session_files where session_id = $1', [SESSION_ID]);
  await getPool().query('update sessions set drive_folder_id = null where id = $1', [SESSION_ID]);

  const sessionDelete = await call('DELETE', `/api/sessions/${SESSION_ID}`, { token });
  check('exclui sessão sem arquivos no Drive', sessionDelete.status === 200, JSON.stringify(sessionDelete.data));

  const afterDelete = await call('GET', `/api/songs/${SONG_ID}`);
  check('sessão some da música', afterDelete.data?.sessions?.length === 0);

  const songDelete = await call('DELETE', `/api/songs/${SONG_ID}`, { token });
  check('exclui música', songDelete.status === 200, JSON.stringify(songDelete.data));

  const gone = await call('GET', `/api/songs/${SONG_ID}`);
  check('música excluída devolve 404', gone.status === 404, `status ${gone.status}`);

  /* --- Cascata no banco -------------------------------------------------- */
  console.log('\nCascata no banco');
  const leftovers = await getPool().query(
    'select count(*)::int as total from session_files where session_id = $1',
    [SESSION_ID],
  );
  check('nenhum arquivo órfão sobra após excluir a música', leftovers.rows[0].total === 0);

  /* --- Rota inexistente -------------------------------------------------- */
  const notFound = await call('GET', '/api/inexistente');
  check('rota desconhecida devolve 404', notFound.status === 404);
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

    console.log(`\n${failures === 0 ? 'TODOS OS TESTES PASSARAM' : `${failures} verificação(ões) falharam`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
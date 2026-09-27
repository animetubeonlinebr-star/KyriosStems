/**
 * KyriosStems - testes das Security Rules
 *
 * Rodam contra o emulador do Firestore, com as regras reais de
 * firestore.rules. Cobrem o que deve ser permitido e, mais
 * importante, o que deve ser negado.
 *
 * Executar:
 *   npm run test:rules
 */

const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
} = require('firebase/firestore');

const PROJECT_ID = 'kyriosstems-rules-test';
const ROOT = path.resolve(__dirname, '..');

/** Música válida, usada como base nos testes. */
function validSong(overrides = {}) {
  const now = new Date().toISOString();
  return {
    title: 'Vim Para Adorar-te',
    artist: 'Adoração e Adoradores',
    album: '',
    key: 'E',
    bpm: 72,
    timeSignature: '4/4',
    duration: 248,
    category: 'Louvor',
    tags: ['adoração', 'lento'],
    coverUrl: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Sessão válida. */
function validSession(overrides = {}) {
  const now = new Date().toISOString();
  return {
    songId: 'song_001',
    daw: 'REAPER',
    dawVersion: '7.x',
    version: 1,
    description: 'Sessão completa com guia e click.',
    format: 'WAV',
    sampleRate: 48000,
    bitDepth: 24,
    duration: 248,
    packageFileId: 'drive_package_file_001',
    packageSize: 1024,
    files: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fileRecord(overrides = {}) {
  return {
    name: '01 Drums.wav',
    path: 'Audio/01 Drums.wav',
    fileId: 'drive_audio_file_001',
    size: 1024,
    category: 'audio',
    contentType: 'audio/wav',
    ...overrides,
  };
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const anon = testEnv.unauthenticatedContext();
  const user = testEnv.authenticatedContext('user_1', { admin: false });
  const admin = testEnv.authenticatedContext('admin_1', { admin: true });

  const anonDb = anon.firestore();
  const userDb = user.firestore();
  const adminDb = admin.firestore();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      passed += 1;
      console.log(`  ok    ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`  FALHA ${name}`);
      console.log(`        ${String(error.message).split('\n')[0]}`);
    }
  }

  console.log('\nFIRESTORE - leitura publica');

  await test('anonimo le musicas', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'songs/song_001'), validSong());
    });
    await assertSucceeds(getDoc(doc(anonDb, 'songs/song_001')));
  });

  await test('anonimo lista a colecao de musicas', async () => {
    await assertSucceeds(getDocs(collection(anonDb, 'songs')));
  });

  await test('anonimo le sessoes', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/session_001'), validSession());
    });
    await assertSucceeds(getDoc(doc(anonDb, 'sessions/session_001')));
  });

  console.log('\nFIRESTORE - escrita negada');

  await test('anonimo nao cria musica', async () => {
    await assertFails(setDoc(doc(anonDb, 'songs/song_x'), validSong()));
  });

  await test('anonimo nao cria sessao', async () => {
    await assertFails(setDoc(doc(anonDb, 'sessions/session_x'), validSession()));
  });

  await test('anonimo nao edita musica existente', async () => {
    await assertFails(updateDoc(doc(anonDb, 'songs/song_001'), { title: 'Invadida' }));
  });

  await test('anonimo nao exclui musica', async () => {
    await assertFails(deleteDoc(doc(anonDb, 'songs/song_001')));
  });

  await test('usuario sem claim admin nao escreve', async () => {
    await assertFails(setDoc(doc(userDb, 'songs/song_y'), validSong()));
  });

  await test('usuario sem claim admin nao exclui', async () => {
    await assertFails(deleteDoc(doc(userDb, 'songs/song_001')));
  });

  console.log('\nFIRESTORE - administrador');

  await test('admin cria musica valida', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'songs/song_010'), validSong()));
  });

  await test('admin cria sessao valida', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'sessions/session_010'), validSession()));
  });

  await test('admin atualiza musica', async () => {
    await assertSucceeds(updateDoc(doc(adminDb, 'songs/song_010'), { title: 'Novo titulo' }));
  });

  await test('admin exclui musica', async () => {
    await assertSucceeds(deleteDoc(doc(adminDb, 'songs/song_010')));
  });

  await test('admin grava sessao com arquivos catalogados', async () => {
    await assertSucceeds(
      setDoc(doc(adminDb, 'sessions/session_011'), validSession({ files: [fileRecord()] })),
    );
  });

  console.log('\nFIRESTORE - validacao de conteudo');

  await test('rejeita musica sem titulo', async () => {
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad1'), validSong({ title: '' })));
  });

  await test('rejeita musica sem interprete', async () => {
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad2'), validSong({ artist: '' })));
  });

  await test('rejeita BPM acima do maximo', async () => {
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad3'), validSong({ bpm: 900 })));
  });

  await test('rejeita BPM abaixo do minimo', async () => {
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad4'), validSong({ bpm: 5 })));
  });

  await test('aceita musica sem BPM', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'songs/song_ok1'), validSong({ bpm: null })));
  });

  await test('aceita musica sem tags', async () => {
    await assertSucceeds(setDoc(doc(adminDb, 'songs/song_ok2'), validSong({ tags: [] })));
  });

  await test('rejeita campo nao previsto na musica', async () => {
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad5'), validSong({ isAdmin: true })));
  });

  await test('rejeita musica sem createdAt', async () => {
    const data = validSong();
    delete data.createdAt;
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad6'), data));
  });

  await test('rejeita tags em excesso', async () => {
    const tags = Array.from({ length: 30 }, (_, i) => `tag${i}`);
    await assertFails(setDoc(doc(adminDb, 'songs/song_bad7'), validSong({ tags })));
  });

  await test('rejeita sessao sem DAW', async () => {
    await assertFails(setDoc(doc(adminDb, 'sessions/session_bad1'), validSession({ daw: '' })));
  });

  await test('rejeita versao zero', async () => {
    await assertFails(setDoc(doc(adminDb, 'sessions/session_bad2'), validSession({ version: 0 })));
  });

  await test('rejeita sample rate absurdo', async () => {
    await assertFails(
      setDoc(doc(adminDb, 'sessions/session_bad3'), validSession({ sampleRate: 999999 })),
    );
  });

  await test('aceita sessao sem pacote enviado', async () => {
    await assertSucceeds(
      setDoc(doc(adminDb, 'sessions/session_ok3'), validSession({ packageFileId: '' })),
    );
  });

  console.log('\nARQUIVOS - validacao no Firestore');

  await test('admin cataloga arquivo com id do Drive', async () => {
    await assertSucceeds(
      setDoc(
        doc(adminDb, 'sessions/session_files_ok'),
        validSession({ files: [fileRecord()] }),
      ),
    );
  });

  await test('recusa arquivo sem id do Drive', async () => {
    await assertFails(
      setDoc(
        doc(adminDb, 'sessions/session_files_bad1'),
        validSession({ files: [fileRecord({ fileId: '' })] }),
      ),
    );
  });

  await test('recusa arquivo com campo nao previsto', async () => {
    await assertFails(
      setDoc(
        doc(adminDb, 'sessions/session_files_bad2'),
        validSession({ files: [fileRecord({ storagePath: 'antigo/caminho' })] }),
      ),
    );
  });

  await test('recusa categoria inexistente', async () => {
    await assertFails(
      setDoc(
        doc(adminDb, 'sessions/session_files_bad3'),
        validSession({ files: [fileRecord({ category: 'outra' })] }),
      ),
    );
  });

  await testEnv.cleanup();

  console.log(`\n${passed} teste(s) passaram, ${failed} falharam`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Erro ao executar os testes:', error);
  process.exit(1);
});
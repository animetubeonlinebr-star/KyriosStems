/**
 * KyriosStems - testes das Security Rules
 *
 * Rodam contra o emulador do Firestore e do Storage, com as regras reais de
 * firestore.rules e storage.rules. Cobrem o que deve ser permitido e, mais
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
const { ref, uploadBytes, getBytes, deleteObject } = require('firebase/storage');

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
    packagePath: 'sessions/song_001/session_001/package/session.zip',
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
    storagePath: 'sessions/song_001/session_001/audio/01 Drums.wav',
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
    storage: {
      rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });

  const anon = testEnv.unauthenticatedContext();
  const user = testEnv.authenticatedContext('user_1', { admin: false });
  const admin = testEnv.authenticatedContext('admin_1', { admin: true });

  const anonDb = anon.firestore();
  const userDb = user.firestore();
  const adminDb = admin.firestore();
  const anonStorage = anon.storage();
  const adminStorage = admin.storage();

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
      setDoc(doc(adminDb, 'sessions/session_ok3'), validSession({ packagePath: '' })),
    );
  });

  console.log('\nSTORAGE - leitura publica');

  await test('anonimo le um pacote', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'sessions/song_001/session_001/package/session.zip'),
        new Uint8Array([1, 2, 3]),
      );
    });
    await assertSucceeds(
      getBytes(ref(anonStorage, 'sessions/song_001/session_001/package/session.zip')),
    );
  });

  console.log('\nSTORAGE - escrita negada');

  await test('anonimo nao envia arquivo', async () => {
    await assertFails(
      uploadBytes(
        ref(anonStorage, 'sessions/song_001/session_001/audio/01 Drums.wav'),
        new Uint8Array([1]),
      ),
    );
  });

  await test('anonimo nao exclui arquivo', async () => {
    await assertFails(
      deleteObject(ref(anonStorage, 'sessions/song_001/session_001/package/session.zip')),
    );
  });

  console.log('\nSTORAGE - administrador');

  await test('admin envia pacote', async () => {
    await assertSucceeds(
      uploadBytes(
        ref(adminStorage, 'sessions/song_020/session_020/package/session.zip'),
        new Uint8Array([1, 2, 3]),
      ),
    );
  });

  await test('admin envia audio', async () => {
    await assertSucceeds(
      uploadBytes(
        ref(adminStorage, 'sessions/song_020/session_020/audio/01 Drums.wav'),
        new Uint8Array([1, 2, 3]),
      ),
    );
  });

  await test('admin envia projeto da DAW', async () => {
    await assertSucceeds(
      uploadBytes(
        ref(adminStorage, 'sessions/song_020/session_020/project/projeto.rpp'),
        new Uint8Array([1]),
      ),
    );
  });

  await test('admin exclui arquivo', async () => {
    await assertSucceeds(
      deleteObject(ref(adminStorage, 'sessions/song_020/session_020/package/session.zip')),
    );
  });

  await test('rejeita categoria inexistente', async () => {
    await assertFails(
      uploadBytes(
        ref(adminStorage, 'sessions/song_020/session_020/invalida/arquivo.bin'),
        new Uint8Array([1]),
      ),
    );
  });

  await test('rejeita arquivo vazio', async () => {
    await assertFails(
      uploadBytes(
        ref(adminStorage, 'sessions/song_020/session_020/audio/vazio.wav'),
        new Uint8Array([]),
      ),
    );
  });

  console.log('\nSTORAGE - caminhos fora da estrutura');

  await test('rejeita envio fora de sessions/', async () => {
    await assertFails(
      uploadBytes(ref(adminStorage, 'outra-pasta/arquivo.bin'), new Uint8Array([1])),
    );
  });

  await test('rejeita nivel extra na estrutura', async () => {
    await assertFails(
      uploadBytes(
        ref(adminStorage, 'sessions/song_020/session_020/audio/extra/arquivo.wav'),
        new Uint8Array([1]),
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
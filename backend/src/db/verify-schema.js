/**
 * KyriosStems - backend/src/db/verify-schema.js
 * Confere que as restrições do banco recusam conteúdo inválido.
 *
 * Cada caso grava um dado inválido e espera erro. Se algum passar, a migração
 * perdeu uma validação e este script falha — é a rede de segurança contra a
 * reescrita silenciosamente afrouxar as regras.
 *
 * Uso:
 *   node src/db/verify-schema.js
 */

import { query, withTransaction, closePool } from './pool.js';

const SONG = {
  id: 'verify_song',
  title: 'Verificação',
  artist: 'Teste',
};

/** Casos que DEVEM ser recusados pelo banco. */
const INVALID = [
  ['música sem título', "insert into songs (id, title, artist) values ('v1', '', 'X')"],
  ['música com título longo demais', `insert into songs (id, title, artist) values ('v2', repeat('a', 201), 'X')`],
  ['música sem intérprete', "insert into songs (id, title, artist) values ('v3', 'X', '')"],
  ['BPM abaixo de 20', "insert into songs (id, title, artist, bpm) values ('v4', 'X', 'Y', 19)"],
  ['BPM acima de 400', "insert into songs (id, title, artist, bpm) values ('v5', 'X', 'Y', 401)"],
  ['duração negativa', "insert into songs (id, title, artist, duration) values ('v6', 'X', 'Y', -1)"],
  ['descrição acima de 2000', `insert into songs (id, title, artist, description) values ('v7', 'X', 'Y', repeat('a', 2001))`],
  ['mais de 20 tags', `insert into songs (id, title, artist, tags) values ('v8', 'X', 'Y', array_fill('t'::text, array[21]))`],
  ['sessão sem música existente', "insert into sessions (id, song_id, daw, version) values ('v9', 'inexistente', 'REAPER', 1)"],
  ['versão zero', "insert into sessions (id, song_id, daw, version) values ('v10', 'verify_song', 'REAPER', 0)"],
  ['sample rate fora da faixa', "insert into sessions (id, song_id, daw, version, sample_rate) values ('v11', 'verify_song', 'REAPER', 1, 4000)"],
  ['bit depth fora da faixa', "insert into sessions (id, song_id, daw, version, bit_depth) values ('v12', 'verify_song', 'REAPER', 1, 4)"],
  ['categoria de arquivo inválida', "insert into session_files (session_id, name, path, drive_file_id, category) values ('verify_sess', 'a.wav', 'a.wav', 'd1', 'inventada')"],
];

/** Casos que DEVEM ser aceitos. */
const VALID = [
  ['música mínima', "insert into songs (id, title, artist) values ('ok1', 'T', 'A') returning id"],
  ['BPM no limite inferior', "insert into songs (id, title, artist, bpm) values ('ok2', 'T', 'A', 20) returning id"],
  ['sessão válida', "insert into sessions (id, song_id, daw, version) values ('ok_sess', 'verify_song', 'REAPER', 1) returning id"],
  ['arquivo válido', "insert into session_files (session_id, name, path, drive_file_id, category) values ('ok_sess', 'a.wav', 'Audio/a.wav', 'd1', 'audio') returning id"],
];

async function run() {
  const failures = [];

  // Dados de apoio, sempre removidos no fim.
  await withTransaction(async (client) => {
    await client.query("delete from session_files where session_id like 'ok_%' or session_id like 'verify%'");
    await client.query("delete from sessions where id like 'ok_%' or id like 'v%'");
    await client.query("delete from songs where id like 'ok%' or id like 'v%'");
    await client.query(
      "insert into songs (id, title, artist) values ($1, $2, $3) on conflict (id) do nothing",
      [SONG.id, SONG.title, SONG.artist],
    );
  });

  console.log('Casos que devem ser RECUSADOS:');
  for (const [label, sql] of INVALID) {
    try {
      await query(sql);
      console.log(`  FALHOU  ${label} — o banco aceitou um dado inválido`);
      failures.push(label);
    } catch {
      console.log(`  ok      ${label}`);
    }
  }

  console.log('\nCasos que devem ser ACEITOS:');
  for (const [label, sql] of VALID) {
    try {
      await query(sql);
      console.log(`  ok      ${label}`);
    } catch (error) {
      console.log(`  FALHOU  ${label} — ${error.message}`);
      failures.push(label);
    }
  }

  // A unicidade de versão por DAW é uma restrição de operação, não de formato:
  // publicar duas vezes a mesma versão da mesma DAW deve ser recusado.
  console.log('\nUnicidade de versão por DAW:');
  try {
    await query("insert into sessions (id, song_id, daw, version) values ('dup', 'verify_song', 'REAPER', 1)");
    console.log('  FALHOU  versão duplicada aceita');
    failures.push('versão duplicada');
  } catch {
    console.log('  ok      versão duplicada recusada');
  }

  // Limpeza.
  await withTransaction(async (client) => {
    await client.query("delete from session_files where session_id like 'ok_%' or session_id like 'verify%'");
    await client.query("delete from sessions where id like 'ok_%' or id like 'v%' or id = 'dup'");
    await client.query("delete from songs where id like 'ok%' or id like 'v%'");
  });

  if (failures.length) {
    console.error(`\n${failures.length} caso(s) não se comportaram como esperado.`);
    process.exitCode = 1;
  } else {
    console.log('\nTodas as restrições se comportaram como esperado.');
  }
}

run()
  .then(() => closePool())
  .catch(async (error) => {
    console.error('\nFalha:', error.message);
    await closePool();
    process.exit(1);
  });
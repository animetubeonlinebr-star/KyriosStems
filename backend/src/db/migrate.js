/**
 * KyriosStems - backend/src/db/migrate.js
 * Aplica as migrações SQL pendentes.
 *
 * Cada arquivo em migrations/ roda uma única vez, dentro de uma transação, e é
 * registrado em schema_migrations. A transação é o que garante que um erro no
 * meio do arquivo não deixe o esquema pela metade.
 *
 * Uso:
 *   node src/db/migrate.js           aplica o que falta
 *   node src/db/migrate.js --status  apenas lista o estado
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, withTransaction, closePool } from './pool.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', 'migrations');

/** Lê os arquivos .sql em ordem lexicográfica. */
function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

/** Versões já aplicadas. */
async function appliedVersions() {
  const { rows } = await getPool().query('select version from schema_migrations');
  return new Set(rows.map((row) => row.version));
}

/**
 * A tabela de controle pode não existir na primeira execução, então ela é
 * criada antes de consultar. Fica fora da migração para que o próprio controle
 * de migrações não dependa de si mesmo.
 */
async function ensureMigrationsTable() {
  await getPool().query(`
    create table if not exists schema_migrations (
      version    text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function migrate({ status = false } = {}) {
  await ensureMigrationsTable();
  const applied = await appliedVersions();
  const files = listMigrations();

  const pending = files.filter((name) => !applied.has(name));

  if (status) {
    console.log('Migrações:');
    for (const name of files) {
      console.log(`  ${applied.has(name) ? '[aplicada]' : '[pendente]'} ${name}`);
    }
    return { applied: [...applied], pending };
  }

  if (!pending.length) {
    console.log('Nada a aplicar. O banco já está atualizado.');
    return { applied: [...applied], pending: [] };
  }

  for (const name of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
    process.stdout.write(`Aplicando ${name}... `);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [name]);
    });
    console.log('ok');
  }

  console.log(`\n${pending.length} migração(ões) aplicada(s).`);
  return { applied: [...applied, ...pending], pending: [] };
}

/** Execução direta pela linha de comando. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const status = process.argv.includes('--status');
  migrate({ status })
    .then(() => closePool())
    .catch(async (error) => {
      console.error('\nFalha na migração:', error.message);
      await closePool();
      process.exit(1);
    });
}

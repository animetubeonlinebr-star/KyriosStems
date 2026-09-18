/**
 * KyriosStems - backend/src/db/pool.js
 * Conexão com o Aiven PostgreSQL.
 *
 * A verificação de TLS é sempre exigida. A CA é a Project CA do Aiven, que é
 * autoassinada — sem ela a conexão falha e a alternativa seria desativar a
 * verificação, o que exporia a senha do banco a um intermediário na rede.
 */

import pg from 'pg';
import { database } from '../config.js';

const { Pool } = pg;

let pool = null;

/** Cria (uma única vez) o pool de conexões. */
export function getPool() {
  if (pool) return pool;

  pool = new Pool({
    host: database.host,
    port: database.port,
    database: database.database,
    user: database.user,
    password: database.password,
    ssl: {
      ca: database.ca,
      rejectUnauthorized: true,
    },
    max: Number(process.env.KYRIOS_DB_POOL_MAX || 5),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
}

/** Executa uma consulta e devolve o resultado completo. */
export function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Executa uma função dentro de uma transação.
 * Faz ROLLBACK em qualquer erro, inclusive nos que escapam da função.
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Encerra o pool. Usado no desligamento e nos scripts. */
export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

/** Verifica a conectividade, devolvendo dados úteis para diagnóstico. */
export async function healthCheck() {
  const { rows } = await query(
    'select current_database() as database, current_user as "user", version() as version',
  );
  return rows[0];
}

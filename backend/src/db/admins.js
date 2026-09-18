/**
 * KyriosStems - backend/src/db/admins.js
 * Acesso aos administradores.
 */

import { query } from './pool.js';

/** Administrador pelo e-mail, incluindo o hash da senha. */
export async function getAdminByEmail(email) {
  const { rows } = await query(
    'select id, email, password_hash from admin_users where email = $1',
    [String(email).trim().toLowerCase()],
  );
  return rows[0] ?? null;
}

/** Administrador pelo id, sem o hash. */
export async function getAdminById(id) {
  const { rows } = await query('select id, email from admin_users where id = $1', [id]);
  return rows[0] ?? null;
}

/** Cria ou substitui um administrador. Usado pelo script de linha de comando. */
export async function upsertAdmin(email, passwordHash) {
  const { rows } = await query(
    `insert into admin_users (email, password_hash)
     values ($1, $2)
     on conflict (email)
     do update set password_hash = excluded.password_hash, updated_at = now()
     returning id, email`,
    [String(email).trim().toLowerCase(), passwordHash],
  );
  return rows[0];
}

/** Quantidade de administradores cadastrados. */
export async function countAdmins() {
  const { rows } = await query('select count(*)::int as total from admin_users');
  return rows[0].total;
}
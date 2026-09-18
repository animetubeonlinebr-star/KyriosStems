/**
 * KyriosStems - backend/src/db/sessions.js
 * Acesso às sessões e aos arquivos de sessão.
 */

import { query, withTransaction } from './pool.js';
import { sessionFromRow, sessionToColumns, fileFromRow } from './mappers.js';

const COLUMNS = `id, song_id, daw, daw_version, version, description, format,
                 sample_rate, bit_depth, duration, package_path, package_size,
                 drive_folder_id, created_at, updated_at`;

/** Todas as sessões, para o catálogo montar as facetas de filtro. */
export async function listSessions() {
  const { rows } = await query(`select ${COLUMNS} from sessions order by song_id, daw, version desc`);
  return rows.map(sessionFromRow);
}

/** Uma sessão pelo id. */
export async function getSession(id) {
  const { rows } = await query(`select ${COLUMNS} from sessions where id = $1`, [id]);
  return sessionFromRow(rows[0]);
}

/** Sessões de uma música. */
export async function listSessionsBySong(songId) {
  const { rows } = await query(
    `select ${COLUMNS} from sessions where song_id = $1 order by daw, version desc`,
    [songId],
  );
  return rows.map(sessionFromRow);
}

/** Arquivos de uma sessão. */
export async function listFilesBySession(sessionId) {
  const { rows } = await query(
    `select name, path, drive_file_id, size, category, content_type
       from session_files where session_id = $1 order by id`,
    [sessionId],
  );
  return rows.map(fileFromRow);
}

/** Arquivos de várias sessões, agrupados por session_id. */
export async function listFilesBySessions(sessionIds) {
  if (!sessionIds.length) return new Map();

  const { rows } = await query(
    `select session_id, name, path, drive_file_id, size, category, content_type
       from session_files where session_id = any($1::text[]) order by id`,
    [sessionIds],
  );

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.session_id)) grouped.set(row.session_id, []);
    grouped.get(row.session_id).push(fileFromRow(row));
  }
  return grouped;
}

/**
 * Cria uma sessão e seus arquivos em uma única transação.
 *
 * Arquivos e sessão entram juntos de propósito. A transação garante que não
 * existe estado intermediário visível em que a sessão aponte para arquivos que
 * não foram registrados.
 */
export async function createSession(session, files = []) {
  return withTransaction(async (client) => {
    const c = sessionToColumns(session);

    const { rows } = await client.query(
      `insert into sessions (id, song_id, daw, daw_version, version, description,
                             format, sample_rate, bit_depth, duration,
                             package_path, package_size, drive_folder_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning ${COLUMNS}`,
      [
        c.id, c.song_id, c.daw, c.daw_version, c.version, c.description,
        c.format, c.sample_rate, c.bit_depth, c.duration,
        c.package_path, c.package_size, c.drive_folder_id,
      ],
    );

    for (const file of files) {
      await client.query(
        `insert into session_files (session_id, name, path, drive_file_id, size, category, content_type)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          session.id, file.name, file.path, file.fileId,
          file.size ?? null, file.category, file.contentType ?? 'application/octet-stream',
        ],
      );
    }

    return sessionFromRow(rows[0]);
  });
}

/** Campos atualizáveis de uma sessão. */
const UPDATABLE = {
  daw: 'daw',
  dawVersion: 'daw_version',
  version: 'version',
  description: 'description',
  format: 'format',
  sampleRate: 'sample_rate',
  bitDepth: 'bit_depth',
  duration: 'duration',
  packageFileId: 'package_path',
  packageSize: 'package_size',
  driveFolderId: 'drive_folder_id',
};

/** Atualiza apenas os campos informados. */
export async function updateSession(id, changes) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (changes[key] === undefined) continue;
    values.push(changes[key]);
    sets.push(`${column} = $${values.length}`);
  }

  if (!sets.length) return getSession(id);

  values.push(id);
  const { rows } = await query(
    `update sessions
        set ${sets.join(', ')}, updated_at = now()
      where id = $${values.length}
      returning ${COLUMNS}`,
    values,
  );
  return sessionFromRow(rows[0]);
}

/** Exclui uma sessão. Arquivos saem por cascade. */
export async function deleteSession(id) {
  const result = await query('delete from sessions where id = $1', [id]);
  return result.rowCount > 0;
}

/** Ids dos arquivos no Drive de uma sessão, para remoção. */
export async function driveFilesOfSession(sessionId) {
  const { rows } = await query(
    'select drive_file_id as file_id, name from session_files where session_id = $1',
    [sessionId],
  );
  return rows;
}

/**
 * Próxima versão de uma DAW, derivada das sessões existentes.
 * Substitui `nextVersion` do modelo, agora resolvido pelo banco para não
 * depender de uma leitura prévia sujeita a corrida.
 */
export async function nextVersion(songId, daw) {
  const { rows } = await query(
    'select coalesce(max(version), 0) + 1 as next from sessions where song_id = $1 and daw = $2',
    [songId, daw],
  );
  return Number(rows[0].next);
}
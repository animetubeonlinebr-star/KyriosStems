/**
 * KyriosStems - backend/src/db/songs.js
 * Acesso às músicas.
 */

import { query, withTransaction } from './pool.js';
import { songFromRow, songToColumns } from './mappers.js';

const COLUMNS = `id, title, artist, album, key, bpm, time_signature, duration,
                 category, tags, cover_url, description, created_at, updated_at`;

/** Todas as músicas, em ordem alfabética de título. */
export async function listSongs() {
  const { rows } = await query(`select ${COLUMNS} from songs order by lower(title)`);
  return rows.map(songFromRow);
}

/** Uma música pelo id. */
export async function getSong(id) {
  const { rows } = await query(`select ${COLUMNS} from songs where id = $1`, [id]);
  return songFromRow(rows[0]);
}

/**
 * Cria uma música.
 *
 * O id vem do cliente, como acontecia no Firestore: é ele que compõe a pasta
 * no Drive antes de qualquer gravação, então precisa existir antes da inserção.
 */
export async function createSong(song) {
  const c = songToColumns(song);
  const { rows } = await query(
    `insert into songs (id, title, artist, album, key, bpm, time_signature, duration,
                        category, tags, cover_url, description)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning ${COLUMNS}`,
    [
      c.id, c.title, c.artist, c.album, c.key, c.bpm, c.time_signature,
      c.duration, c.category, c.tags, c.cover_url, c.description,
    ],
  );
  return songFromRow(rows[0]);
}

/** Campos que podem ser atualizados em uma música. */
const UPDATABLE = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  key: 'key',
  bpm: 'bpm',
  timeSignature: 'time_signature',
  duration: 'duration',
  category: 'category',
  tags: 'tags',
  coverUrl: 'cover_url',
  description: 'description',
};

/**
 * Atualiza apenas os campos informados.
 * A lista de campos permitidos é explícita: um nome de coluna vindo do corpo da
 * requisição nunca é interpolado direto no SQL.
 */
export async function updateSong(id, changes) {
  const sets = [];
  const values = [];

  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (changes[key] === undefined) continue;
    values.push(changes[key]);
    sets.push(`${column} = $${values.length}`);
  }

  if (!sets.length) return getSong(id);

  values.push(id);
  const { rows } = await query(
    `update songs
        set ${sets.join(', ')}, updated_at = now()
      where id = $${values.length}
      returning ${COLUMNS}`,
    values,
  );
  return songFromRow(rows[0]);
}

/**
 * Exclui uma música e tudo que depende dela.
 * As sessões e os arquivos saem por ON DELETE CASCADE, na mesma transação.
 */
export async function deleteSong(id) {
  const result = await query('delete from songs where id = $1', [id]);
  return result.rowCount > 0;
}

/** Ids dos arquivos no Drive de todas as sessões de uma música. */
export async function driveFilesOfSong(songId) {
  const { rows } = await query(
    `select f.drive_file_id as file_id, f.name
       from session_files f
       join sessions s on s.id = f.session_id
      where s.song_id = $1`,
    [songId],
  );
  return rows;
}

/** Ids das pastas no Drive de todas as sessões de uma música. */
export async function driveFoldersOfSong(songId) {
  const { rows } = await query(
    'select drive_folder_id as folder_id from sessions where song_id = $1 and drive_folder_id is not null',
    [songId],
  );
  return rows.map((row) => row.folder_id);
}

export { withTransaction };
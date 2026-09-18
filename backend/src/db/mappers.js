/**
 * KyriosStems - backend/src/db/mappers.js
 * Converte linhas do PostgreSQL no formato que a aplicação já consumia.
 *
 * O frontend usa camelCase. Manter esse contrato evita reescrever as páginas:
 * só a camada de repositório muda.
 *
 * `numeric` e `bigint` chegam do driver como string, para não perder precisão.
 * A conversão para number acontece aqui, em um único lugar, para que nenhuma
 * camada acima precise lembrar disso.
 */

/** Converte string numérica do driver em number, preservando null. */
function num(value) {
  return value === null || value === undefined ? null : Number(value);
}

/** Converte timestamptz em string ISO 8601. */
function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

/** Linha de `songs` -> objeto da aplicação. */
export function songFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    key: row.key,
    bpm: num(row.bpm),
    timeSignature: row.time_signature,
    duration: num(row.duration),
    category: row.category,
    tags: row.tags ?? [],
    coverUrl: row.cover_url,
    description: row.description,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** Linha de `sessions` -> objeto da aplicação. */
export function sessionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    songId: row.song_id,
    daw: row.daw,
    dawVersion: row.daw_version,
    version: num(row.version),
    description: row.description,
    format: row.format,
    sampleRate: num(row.sample_rate),
    bitDepth: num(row.bit_depth),
    duration: num(row.duration),
    // Id do arquivo do pacote no Google Drive: não há caminho, há id.
    packageFileId: row.package_path || '',
    packageSize: num(row.package_size),
    driveFolderId: row.drive_folder_id,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/** Linha de `session_files` -> objeto da aplicação. */
export function fileFromRow(row) {
  if (!row) return null;
  return {
    name: row.name,
    path: row.path,
    fileId: row.drive_file_id,
    size: num(row.size),
    category: row.category,
    contentType: row.content_type,
  };
}

/** Objeto da aplicação -> colunas de `songs`. */
export function songToColumns(song) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album ?? '',
    key: song.key ?? '',
    bpm: song.bpm ?? null,
    time_signature: song.timeSignature ?? '',
    duration: song.duration ?? null,
    category: song.category ?? '',
    tags: song.tags ?? [],
    cover_url: song.coverUrl ?? '',
    description: song.description ?? '',
  };
}

/** Objeto da aplicação -> colunas de `sessions`. */
export function sessionToColumns(session) {
  return {
    id: session.id,
    song_id: session.songId,
    daw: session.daw,
    daw_version: session.dawVersion ?? '',
    version: session.version,
    description: session.description ?? '',
    format: session.format ?? '',
    sample_rate: session.sampleRate ?? null,
    bit_depth: session.bitDepth ?? null,
    duration: session.duration ?? null,
    package_path: session.packageFileId ?? '',
    package_size: session.packageSize ?? null,
    drive_folder_id: session.driveFolderId ?? null,
  };
}
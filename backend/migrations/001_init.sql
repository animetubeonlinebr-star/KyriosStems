-- ============================================================================
-- KyriosStems - Esquema inicial
--
-- Substitui o Firestore. O que era validado pelas Security Rules passa a ser
-- validado pelo banco: as restrições CHECK abaixo reproduzem, campo a campo,
-- os limites de firestore.rules. A validação em CHECK é a última linha de
-- defesa; ela vale mesmo que um erro na API deixe passar um valor inválido.
--
-- Diferença de tipos em relação ao Firestore:
--   createdAt/updatedAt eram string ISO 8601 -> agora timestamptz
--   tags era array de strings            -> agora text[]
--   files era array de objetos           -> agora tabela session_files
--   caminhos de arquivo                  -> agora id do arquivo no Google Drive
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Administradores
--
-- Substitui a custom claim `admin` do Firebase Authentication. A senha é
-- guardada apenas como hash (scrypt); nunca em texto claro.
-- ---------------------------------------------------------------------------
create table if not exists admin_users (
  id            bigserial primary key,
  email         text        not null unique,
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint admin_users_email_lowercase check (email = lower(email)),
  constraint admin_users_email_shape     check (position('@' in email) > 1)
);

-- ---------------------------------------------------------------------------
-- Músicas
-- ---------------------------------------------------------------------------
create table if not exists songs (
  id             text primary key,
  title          text        not null,
  artist         text        not null,
  album          text        not null default '',
  key            text        not null default '',
  bpm            numeric(6,2),
  time_signature text        not null default '',
  duration       numeric(10,3),
  category       text        not null default '',
  tags           text[]      not null default '{}',
  cover_url      text        not null default '',
  description    text        not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Limites de tamanho, espelhando firestore.rules.
  constraint songs_id_shape        check (char_length(id) between 1 and 128),
  constraint songs_title_len       check (char_length(title) between 1 and 200),
  constraint songs_artist_len      check (char_length(artist) between 1 and 200),
  constraint songs_album_len       check (char_length(album) <= 200),
  constraint songs_key_len         check (char_length(key) <= 8),
  constraint songs_time_sig_len    check (char_length(time_signature) <= 8),
  constraint songs_category_len    check (char_length(category) <= 60),
  constraint songs_cover_url_len   check (char_length(cover_url) <= 2048),
  constraint songs_description_len check (char_length(description) <= 2000),

  -- Faixas numéricas.
  constraint songs_bpm_range       check (bpm is null or (bpm >= 20 and bpm <= 400)),
  constraint songs_duration_pos    check (duration is null or duration > 0),

  -- Até 20 tags.
  constraint songs_tags_max        check (cardinality(tags) <= 20)
);

create index if not exists songs_created_at_idx on songs (created_at desc);
create index if not exists songs_tags_idx       on songs using gin (tags);

-- ---------------------------------------------------------------------------
-- Sessões DAW
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id              text primary key,
  song_id         text        not null references songs (id) on delete cascade,
  daw             text        not null,
  daw_version     text        not null default '',
  version         integer     not null,
  description     text        not null default '',
  format          text        not null default '',
  sample_rate     integer,
  bit_depth       integer,
  duration        numeric(10,3),
  package_path    text        not null default '',
  package_size    bigint,
  -- Pasta da sessão no Google Drive. Substitui o prefixo de caminho que antes
  -- era derivado de sessions/{songId}/{sessionId} no Firebase Storage.
  drive_folder_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint sessions_id_shape          check (char_length(id) between 1 and 128),
  constraint sessions_song_id_len       check (char_length(song_id) between 1 and 128),
  constraint sessions_daw_len           check (char_length(daw) between 1 and 60),
  constraint sessions_daw_version_len   check (char_length(daw_version) <= 40),
  constraint sessions_description_len   check (char_length(description) <= 1000),
  constraint sessions_format_len        check (char_length(format) <= 20),
  constraint sessions_package_path_len  check (char_length(package_path) <= 1024),

  constraint sessions_version_range     check (version >= 1 and version <= 999),
  constraint sessions_sample_rate_range check (sample_rate is null or (sample_rate >= 8000 and sample_rate <= 384000)),
  constraint sessions_bit_depth_range   check (bit_depth is null or (bit_depth >= 8 and bit_depth <= 64)),
  constraint sessions_duration_pos      check (duration is null or duration > 0),
  constraint sessions_package_size_pos  check (package_size is null or package_size > 0),

  -- Uma versão por DAW: publicar duas vezes o mesmo número é erro de operação,
  -- não um estado válido. O banco recusa, em vez de deixar a duplicata entrar
  -- e a apresentação escolher arbitrariamente.
  constraint sessions_song_daw_version_unique unique (song_id, daw, version)
);

create index if not exists sessions_song_id_idx on sessions (song_id);
create index if not exists sessions_daw_idx     on sessions (daw);

-- ---------------------------------------------------------------------------
-- Arquivos de uma sessão
--
-- Antes era o array `files` do documento. Como agora cada arquivo tem um id do
-- Drive próprio, virou tabela: permite renomear, reenviar e remover arquivo
-- individualmente sem reescrever a sessão inteira.
-- ---------------------------------------------------------------------------
create table if not exists session_files (
  id            bigserial primary key,
  session_id    text        not null references sessions (id) on delete cascade,
  name          text        not null,
  -- Caminho relativo dentro do pacote (o que o usuário vê na página da música).
  path          text        not null,
  -- Identificador do arquivo no Google Drive. Substitui `storagePath`.
  drive_file_id text        not null,
  size          bigint,
  category      text        not null,
  content_type  text        not null default 'application/octet-stream',
  created_at    timestamptz not null default now(),

  constraint session_files_name_len     check (char_length(name) between 1 and 512),
  constraint session_files_path_len     check (char_length(path) between 1 and 1024),
  constraint session_files_category     check (category in ('package', 'project', 'audio', 'aux')),
  constraint session_files_size_pos     check (size is null or size >= 0)
);

create index if not exists session_files_session_id_idx on session_files (session_id);
create index if not exists session_files_drive_id_idx   on session_files (drive_file_id);

-- ---------------------------------------------------------------------------
-- Controle de migrações
-- ---------------------------------------------------------------------------
create table if not exists schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
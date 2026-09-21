# Banco de dados

## Tabelas

```text
songs/{id}
sessions/{id}         → song_id
session_files/{id}    → session_id
admin_users/{id}
```

`session_files` é tabela, e não um campo de lista, porque cada arquivo tem um
identificador próprio no Google Drive. Isso permite renomear, reenviar e remover
arquivo individualmente sem reescrever a sessão inteira.

## Song

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | text | sim | Gerado no cliente (`song_<base36><aleatório>`) |
| `title` | text | sim | Nome da música |
| `artist` | text | sim | Intérprete |
| `album` | text | não | Álbum |
| `key` | text | não | Tom (`E`, `Am`) |
| `bpm` | numeric | não | 20 a 400 |
| `time_signature` | text | não | `4/4`, `6/8` |
| `duration` | numeric | não | Segundos, maior que zero |
| `category` | text | não | Louvor, Adoração... |
| `tags` | text[] | não | Até 20 |
| `cover_url` | text | não | Capa |
| `description` | text | não | Até 2000 caracteres |
| `created_at` | timestamptz | sim | |
| `updated_at` | timestamptz | sim | |

O `id` é gerado no cliente porque compõe o nome da pasta no Drive antes de
qualquer gravação — precisa existir antes da inserção.

## DawSession

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | text | sim | Gerado no cliente |
| `song_id` | text | sim | Referência à música (`on delete cascade`) |
| `daw` | text | sim | REAPER, Ableton Live... |
| `daw_version` | text | não | `7.x`, `12` |
| `version` | integer | sim | 1 a 999 |
| `description` | text | não | Até 1000 caracteres |
| `format` | text | não | WAV, AIFF, FLAC |
| `sample_rate` | integer | não | 8000 a 384000 |
| `bit_depth` | integer | não | 8 a 64 |
| `duration` | numeric | não | Segundos |
| `package_path` | text | não | **Id do arquivo ZIP no Google Drive** |
| `package_size` | bigint | não | Bytes |
| `drive_folder_id` | text | não | Pasta da sessão no Drive |
| `created_at` | timestamptz | sim | |
| `updated_at` | timestamptz | sim | |

`package_path` manteve o nome da coluna por continuidade, mas guarda um id de
arquivo do Drive, não um caminho.

## SessionFile

| Campo | Descrição |
|---|---|
| `name` | Nome exibido |
| `path` | Caminho relativo dentro do pacote (`Audio/01 Drums.wav`) |
| `drive_file_id` | Identificador do arquivo no Google Drive |
| `size` | Bytes |
| `category` | `package`, `project`, `audio` ou `aux` |
| `content_type` | Tipo MIME |

## Versionamento

Uma música pode ter várias sessões para a mesma DAW. A versão é derivada das
sessões existentes (`nextVersion`), e a maior versão de cada DAW é marcada como
atual na apresentação (`markCurrentVersions`). O histórico permanece disponível.

```text
Vim Para Adorar-te
├── REAPER
│   ├── v2  (atual)
│   └── v1  (histórico)
└── Ableton Live
    └── v1  (atual)
```

Há uma restrição de unicidade em `(song_id, daw, version)`. Publicar duas vezes a
mesma versão da mesma DAW é erro de operação, e o banco recusa em vez de deixar
a duplicata entrar e a apresentação escolher arbitrariamente.

## Validação

Os limites de `firestore.rules` foram transportados para restrições `CHECK`. Elas
são a última linha de defesa: valem mesmo que um erro na API deixe passar um
valor inválido.

Rode `npm run db:verify` no backend. O script grava dados inválidos e espera que
o banco recuse cada um; se algum passar, a validação foi afrouxada sem que
ninguém percebesse.

## Consultas usadas

| Operação | Consulta |
|---|---|
| Catálogo | todas as músicas + todas as sessões + arquivos das sessões |
| Página da música | música + sessões de `song_id` + arquivos |
| Próxima versão | `max(version) + 1` para `(song_id, daw)` |
| Exclusão de música | `delete from songs` (cascata em sessões e arquivos) |

O catálogo carrega tudo e monta os filtros no cliente. Isso mantém a navegação
instantânea e funciona bem para uma biblioteca pessoal. Se a biblioteca crescer
muito, o próximo passo é paginar a lista de músicas.

Não há índice composto necessário: as consultas usam `song_id` em uma única
coluna, que já tem índice.

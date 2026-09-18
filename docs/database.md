# Banco de dados

## Coleções

```text
songs/{songId}
sessions/{sessionId}
```

As duas coleções são planas, com `sessions.songId` ligando a sessão à música.
Essa escolha evita subcoleções: permite listar todas as sessões de uma vez para
montar as facetas de filtro do catálogo e consultar as sessões de uma música
com uma única cláusula `where`.

## Song

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `title` | string | sim | Nome da música |
| `artist` | string | sim | Intérprete |
| `album` | string | não | Álbum |
| `key` | string | não | Tom (`E`, `Am`) |
| `bpm` | number \| null | não | 20 a 400 |
| `timeSignature` | string | não | `4/4`, `6/8` |
| `duration` | number \| null | não | Segundos |
| `category` | string | não | Louvor, Adoração... |
| `tags` | string[] | não | Até 20 |
| `coverUrl` | string | não | Capa |
| `description` | string | não | Até 2000 caracteres |
| `createdAt` | string | sim | ISO 8601 |
| `updatedAt` | string | sim | ISO 8601 |

O `id` é gerado no cliente (`song_<base36><aleatório>`) e usado como nome do
documento. Isso permite compor o caminho no Storage antes de qualquer gravação.

## DawSession

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `songId` | string | sim | Referência à música |
| `daw` | string | sim | REAPER, Ableton Live... |
| `dawVersion` | string | não | `7.x`, `12` |
| `version` | number | sim | Inteiro ≥ 1 |
| `description` | string | não | Até 1000 caracteres |
| `format` | string | não | WAV, AIFF, FLAC |
| `sampleRate` | number \| null | não | 8000 a 384000 |
| `bitDepth` | number \| null | não | 8 a 64 |
| `duration` | number \| null | não | Segundos |
| `packagePath` | string | não | Caminho do ZIP no Storage |
| `packageSize` | number \| null | não | Bytes |
| `files` | File[] | não | Até 300 arquivos |
| `createdAt` | string | sim | ISO 8601 |
| `updatedAt` | string | sim | ISO 8601 |

### File

| Campo | Descrição |
|---|---|
| `name` | Nome exibido |
| `path` | Caminho relativo dentro do pacote (`Audio/01 Drums.wav`) |
| `storagePath` | Caminho real no Storage |
| `size` | Bytes |
| `category` | `package`, `project`, `audio` ou `aux` |
| `contentType` | Tipo MIME |

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

## Consultas usadas

| Operação | Consulta |
|---|---|
| Catálogo | `getDocs(collection(db, 'songs'))` + `getDocs(collection(db, 'sessions'))` |
| Página da música | `getDoc(songs/{id})` + `where('songId', '==', id)` |
| Exclusão de música | `where('songId', '==', id)` + `writeBatch` |

O catálogo carrega as duas coleções inteiras e monta os filtros no cliente. Isso
mantém a navegação instantânea e funciona bem para uma biblioteca pessoal. Se a
biblioteca crescer muito, o próximo passo é paginar a coleção de músicas.
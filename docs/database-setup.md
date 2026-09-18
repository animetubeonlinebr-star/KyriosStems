# Criar o banco de dados

Passo a passo para ativar o Firestore no projeto `kyriosstems`.

---

## Antes de começar: decida a região

A região do Firestore é **permanente**. Não dá para mudar depois de criada — se
errar, só recriando o projeto.

| | |
|---|---|
| **Região** | `southamerica-east1` (São Paulo) |
| **Tipo** | Nativo (Native mode) |

São Paulo fica mais perto do Brasil e reduz a latência de leitura e escrita. As
alternativas comuns são `us-central1` (Iowa) e `nam5` (Estados Unidos). Qualquer
uma funciona; a diferença é de velocidade para você.

O KyriosStems foi escrito para o **modo Nativo**. Não use o modo Datastore.

---

## Caminho A — pelo console (recomendado na primeira vez)

### 1. Abra o Firestore

[console.firebase.google.com](https://console.firebase.google.com) → projeto
**kyriosstems** → menu lateral **Build → Firestore Database** → **Criar banco
de dados**.

### 2. Escolha o modo

Selecione **Modo de produção** (não o de teste).

O modo de teste libera leitura e escrita para qualquer pessoa por 30 dias. Nós já
temos regras prontas e testadas, então não precisamos dele.

### 3. Escolha a região

Selecione **southamerica-east1 (São Paulo)**.

Se a região não aparecer na lista, use **us-central1**. Os dados ficam nos
Estados Unidos e tudo continua funcionando.

### 4. Confirme

Clique em **Ativar**. A criação leva cerca de um minuto.

### 5. Publique as regras

As regras versionadas no repositório substituem as padrão:

```bash
npm run deploy:rules
```

Na primeira vez é preciso entrar na conta:

```bash
firebase login
firebase use kyriosstems
npm run deploy:rules
```

---

## Caminho B — automatizado

Um comando faz tudo: ativa as APIs, cria o banco em São Paulo, verifica o
bucket, cria o usuário e concede o acesso administrativo.

**Pré-requisito:** a chave de serviço.

Console do Firebase → ⚙️ **Configurações do projeto** → aba **Contas de
serviço** → **Gerar nova chave privada** → salve como `serviceAccount.json` na
raiz do projeto.

```bash
npm install
node scripts/setup-firebase.js --email animetubeonlinebr@gmail.com --password "SUA_SENHA"
```

O arquivo de credenciais já está no `.gitignore` e nunca deve ser versionado.

---

## O que será criado

### Coleções

Duas coleções são usadas. O Firestore é schema-less: elas nascem no primeiro
documento gravado, não é preciso criá-las manualmente.

```text
songs/{songId}
sessions/{sessionId}
```

### Documento `songs/{songId}`

```json
{
  "title": "Vim Para Adorar-te",
  "artist": "Adoração e Adoradores",
  "album": "",
  "key": "E",
  "bpm": 72,
  "timeSignature": "4/4",
  "duration": 248,
  "category": "Louvor",
  "tags": ["adoração", "lento"],
  "coverUrl": "",
  "description": "",
  "createdAt": "2026-09-18T12:00:00.000Z",
  "updatedAt": "2026-09-18T12:00:00.000Z"
}
```

O `id` fica no nome do documento, não dentro dele.

### Documento `sessions/{sessionId}`

```json
{
  "songId": "song_001",
  "daw": "REAPER",
  "dawVersion": "7.x",
  "version": 1,
  "description": "Sessão completa com guia e click.",
  "format": "WAV",
  "sampleRate": 48000,
  "bitDepth": 24,
  "duration": 248,
  "packagePath": "sessions/song_001/session_001/package/session.zip",
  "packageSize": 1073741824,
  "files": [],
  "createdAt": "2026-09-18T12:00:00.000Z",
  "updatedAt": "2026-09-18T12:00:00.000Z"
}
```

### Índices

**Nenhum índice composto é necessário.** As consultas usam apenas
`where('songId', '==', valor)` em um campo único, que o Firestore já indexa
automaticamente.

Se você vir no console um aviso de índice ausente, ele trará um link direto para
criar o índice necessário.

---

## Convenção de tipos

O KyriosStems grava os campos assim:

| Campo | Tipo | Observação |
|---|---|---|
| `createdAt`, `updatedAt` | string | ISO 8601 — **não** Timestamp |
| `bpm`, `duration`, `sampleRate`, `bitDepth`, `version` | number | |
| `packageSize` | number | Bytes |
| `tags` | array de strings | Até 20 |
| `files` | array de objetos | Até 300 |
| Campos vazios | string vazia `""` | Não `null` |

Datas como string mantêm o código simples e as regras de segurança conseguem
validá-las como texto. O utilitário `toDate` lida com os dois formatos, caso você
migre para `Timestamp` no futuro.

---

## Verificar se funcionou

Com o banco criado e as regras publicadas, o catálogo deixa de mostrar dados de
demonstração. Abra `index.html` e observe:

| Estado | O que aparece |
|---|---|
| Banco não criado | Aviso de falha na leitura + biblioteca de demonstração |
| Banco criado, sem dados | Estado "Biblioteca vazia" |
| Banco com dados | Catálogo real |

Enquanto a API estiver desativada, a tela mostra:

> Não foi possível ler a biblioteca. O Firestore não está provisionado neste
> projeto. Ative o banco no console do Firebase.

---

## Se algo der errado

### "The project was not found" ou erro de região

A região é definitiva. Confira em **Firestore Database → Configurações** qual foi
escolhida.

### Aviso de que o índice composto está faltando

Só acontece se alguém adicionar `orderBy` combinado com `where`. Hoje não há.
Use o link que o próprio erro fornece.

### O catálogo continua mostrando dados de demonstração

A leitura está falhando. Verifique, em ordem:

1. O banco realmente existe no console
2. As regras foram publicadas (`npm run deploy:rules`)
3. O `projectId` em `js/firebase/config.js` é `kyriosstems`

---

## Depois do banco

Faltam ainda:

1. **Storage** — mesmo console, em **Build → Storage → Começar**.
   O bucket deve se chamar exatamente `kyriosstems.firebasestorage.app`
2. **Authentication** — **Build → Authentication → Sign-in method**, ativar
   **E-mail/senha**
3. **Usuário admin** — **Authentication → Users → Adicionar usuário**
4. **Custom claim** — `npm run admin:grant -- animetubeonlinebr@gmail.com`
5. **Publicar as regras** — `npm run deploy:rules`

Detalhes em `docs/security.md` e `README.md`.

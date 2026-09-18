# KYRIOS STEMS

### Personal Worship Multitrack Library

**Repositório pessoal de sessões musicais de louvor preparadas para utilização em DAWs.**

---

## 1. Visão Geral

O **KyriosStems** é uma aplicação web pessoal destinada ao armazenamento, organização,
catalogação e download de músicas de louvor preparadas para produção musical em uma DAW.

O sistema **não realiza separação de stems, edição de áudio, mixagem, processamento ou
conversão de arquivos**. Todo o processamento musical acontece externamente, utilizando
ferramentas como uma DAW, ferramentas de separação de áudio, FFmpeg ou outros softwares.

O KyriosStems recebe os arquivos já preparados e os organiza em uma biblioteca. O objetivo
principal é permitir que uma sessão musical seja armazenada e posteriormente baixada como um
pacote completo, contendo o projeto da DAW e todos os arquivos de áudio necessários para
abri-lo corretamente.

---

## 2. Conceito Principal

```text
MÚSICA
   │
   ├── Informações musicais
   │
   └── SESSÕES DAW
          │
          ├── Projeto da DAW
          ├── Arquivos WAV
          ├── Arquivos auxiliares
          └── Pacote completo
```

Uma música pode possuir uma ou mais sessões. Exemplo:

```text
Vim Para Adorar-te
│
├── REAPER
│   ├── v2  (atual)
│   └── v1  (histórico)
│
└── Ableton Live
    └── v1
```

---

## 3. Arquitetura

```text
                    ┌─────────────────┐
                    │   GitHub Pages  │
                    │ HTML5/CSS3/JS   │
                    └────────┬────────┘
                             │ Firebase SDK
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
       Firebase Auth     Firestore       Firebase Storage
            │                │                │
         ADMIN           METADADOS         ARQUIVOS
                             │                ├── ZIP
                             ▼                ├── WAV
                         CATÁLOGO             ├── Projeto
                             │                └── Auxiliares
                             ▼
                         DOWNLOAD
```

O frontend é estático e não requer build. O Firebase é carregado dinamicamente pelo CDN
apenas quando configurado.

---

## 4. Estrutura do Repositório

```text
kyrios-stems/
├── index.html              Catálogo (biblioteca)
├── song.html               Página da música
├── login.html              Acesso administrativo
├── admin.html              Painel administrativo
├── css/
│   ├── variables.css       Design system (tokens)
│   ├── reset.css
│   ├── global.css
│   ├── components.css
│   ├── catalog.css
│   ├── song.css
│   └── admin.css
├── js/
│   ├── core/               Constantes, DOM, formatação e async
│   ├── firebase/           Configuração, inicialização e autenticação
│   ├── models/             Song e DawSession
│   ├── repositories/       Acesso a Firestore e Storage
│   ├── services/           Biblioteca, download e publicação
│   ├── components/         Cartões, busca, filtros, navegação
│   ├── pages/              Controladores das páginas
│   ├── ui/                 Ícones, toasts, modais
│   └── data/               Biblioteca de demonstração
├── assets/
└── docs/
```

---

## 5. Modelo de Dados

### Song

```json
{
  "id": "song_001",
  "title": "Vim Para Adorar-te",
  "artist": "Adoração e Adoradores",
  "key": "E",
  "bpm": 72,
  "timeSignature": "4/4",
  "category": "Louvor",
  "tags": ["adoração", "lento"],
  "coverUrl": "",
  "description": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### DawSession

```json
{
  "id": "session_001",
  "songId": "song_001",
  "daw": "REAPER",
  "dawVersion": "7.x",
  "version": 2,
  "description": "Sessão completa com guia e click",
  "format": "WAV",
  "sampleRate": 48000,
  "bitDepth": 24,
  "duration": 248,
  "packagePath": "sessions/song_001/session_001/package/session.zip",
  "packageSize": 1073741824,
  "files": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 6. Armazenamento

```text
sessions/
└── {songId}/
    └── {sessionId}/
        ├── package/
        │   └── session.zip
        ├── project/
        │   └── projeto.rpp
        ├── audio/
        │   ├── 01 Drums.wav
        │   └── 02 Bass.wav
        └── aux/
            └── README.txt
```

O ZIP é o pacote principal de download. Os arquivos individuais existem para consulta e
download opcional.

---

## 7. Modo demonstração

Enquanto `js/firebase/config.js` mantiver os valores de exemplo, a aplicação funciona em
**modo demonstração**: o catálogo é exibido com uma biblioteca local de exemplo, o login fica
indisponível e o download é bloqueado com uma mensagem explícita.

Isso permite avaliar toda a interface antes de criar o projeto no Firebase.

---

## 8. Configuração do Firebase

### 8.1 Ativar os serviços

No [Console do Firebase](https://console.firebase.google.com), projeto `kyriosstems`:

| Serviço | Onde | O que fazer |
|---|---|---|
| Authentication | Authentication > Sign-in method | Ativar **E-mail/senha** e criar o usuário administrador |
| Firestore | Firestore Database | Criar o banco (modo produção) |
| Storage | Storage | Ativar o bucket |

### 8.2 Publicar as Security Rules

As regras estão versionadas no repositório. Publicar antes de cadastrar qualquer
coisa:

```bash
npm install
firebase login
firebase use kyriosstems
npm run deploy:rules
```

Sem as rules, o Firestore fica fechado por padrão — o que é seguro, mas o
catálogo não carrega.

### 8.3 Conceder o acesso administrativo

O login exige a custom claim `admin`, que não pode ser definida pelo SDK Web:

```bash
# Gere uma chave de serviço no console:
# Configurações do projeto > Contas de serviço > Gerar nova chave privada
# Salve como serviceAccount.json na raiz (já está no .gitignore)

npm run admin:grant -- seu@email.com
```

Para revogar: `npm run admin:grant -- seu@email.com --revoke`

Depois disso, **entre novamente** no painel: o token em uso ainda carrega as
claims antigas.

### 8.4 Restringir a chave de API

No Google Cloud Console, em *APIs e serviços > Credenciais*, limite a chave aos
domínios do GitHub Pages e a `localhost` durante o desenvolvimento.

---

## 9. Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` publica automaticamente a cada push na
`main`, após rodar a verificação de integridade e os testes das rules.

Ative uma vez em **Settings > Pages > Source: GitHub Actions**.

O site fica em `https://<usuario>.github.io/KyriosStems/`.

---

## 10. Desenvolvimento

```bash
npm install

npm run serve          # servidor local em http://localhost:12000
npm run check          # verificação de integridade do projeto
npm run test:rules     # testa as Security Rules no emulador
npm run deploy:rules   # publica as rules no Firebase
```

### Verificação automática

`npm run check` confere, sem depender de rede:

- imports resolvem e os símbolos importados existem
- não há declarações duplicadas
- toda classe usada pelo JavaScript tem estilo
- as páginas carregam módulos e seus assets existem
- nenhum arquivo de mídia foi versionado

`npm run test:rules` exercita as Security Rules contra o emulador, cobrindo o que
deve ser permitido e o que deve ser negado.

---

## 11. Segurança

A proteção dos dados é aplicada nas **Security Rules** do Firestore e do Storage,
não na interface. A existência de `admin.html` não autoriza ninguém.

```text
Aplicação pública    READ songs/sessions/arquivos   → permitido
                     WRITE / DELETE                 → negado

Administrador        READ / CREATE / UPDATE / DELETE / UPLOAD → permitido
(custom claim admin)
```

As rules também validam o **conteúdo** gravado: campos permitidos, campos
obrigatórios, limites de tamanho e faixas numéricas. Isso impede que um
documento válido seja gravado com campos arbitrários.

As chaves do Firebase Web SDK são públicas por natureza. A restrição de domínio
nas chaves de API e as Security Rules são o que protege a biblioteca.

Detalhes em `docs/security.md`.

---

## 12. Privacidade dos Arquivos

```text
GitHub
   └── Código

Firebase
   ├── Banco
   └── Arquivos de áudio
```

Os arquivos de áudio e os pacotes de sessão **não são armazenados no repositório
Git**. O `.gitignore` bloqueia as extensões de mídia, e a verificação de
integridade falha se alguma for versionada.

---

## 13. Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/database-setup.md` | Passo a passo para criar o banco |
| `docs/architecture.md` | Camadas, modos de operação, ordem de gravação |
| `docs/database.md` | Coleções, campos e consultas |
| `docs/storage.md` | Estrutura de pastas, envio e download |
| `docs/security.md` | Rules, custom claim e restrição de chave |
| `docs/workflow.md` | Publicação, versionamento e manutenção |

---

## 14. Roadmap

### MVP

- [x] Catálogo: lista, busca, filtros e página da música
- [x] Modelos de dados e camada de acesso
- [x] Firebase: configuração e Authentication
- [x] Administração: visão geral, biblioteca e cadastro em 5 etapas
- [x] Upload de pacote e arquivos individuais
- [x] Download do pacote completo
- [x] Security Rules com testes automatizados
- [x] Publicação no GitHub Pages

### Futuro

Favoritos, histórico de downloads, capa da música, busca avançada, filtros
combinados, estatísticas da biblioteca, validação de arquivos, visualização da
estrutura do pacote e backup.

---

## 15. Princípio Arquitetural

> **KyriosStems armazena e organiza sessões prontas; não modifica o conteúdo
> musical.**

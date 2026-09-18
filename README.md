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
                    │  GitHub Pages   │
                    │ HTML5/CSS3/JS   │
                    └────────┬────────┘
                             │ HTTPS + token de sessão
                             ▼
                    ┌─────────────────┐
                    │    Backend      │
                    │  Node, sem      │
                    │  framework      │
                    └───┬─────────┬───┘
                        │         │
              ┌─────────▼──┐   ┌──▼──────────────┐
              │   Aiven    │   │  Google Drive   │
              │ PostgreSQL │   │                 │
              │            │   │  ├── ZIP        │
              │ METADADOS  │   │  ├── WAV        │
              └────────────┘   │  └── Projeto    │
                               └─────────────────┘
```

O frontend é estático e não requer build. O backend guarda os dois segredos — a
senha do banco e o refresh token do Drive — e é o único que decide quem pode
escrever.

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
│   ├── core/               Constantes, config, DOM, formatação e async
│   ├── api/                Cliente HTTP, sessão e autenticação
│   ├── models/             Song e DawSession
│   ├── repositories/       Acesso à API: biblioteca e arquivos
│   ├── services/           Biblioteca, download e publicação
│   ├── components/         Cartões, busca, filtros, navegação
│   ├── pages/              Controladores das páginas
│   ├── ui/                 Ícones, toasts, modais
│   └── data/               Biblioteca de demonstração
├── backend/
│   ├── src/                API: auth, db, drive, http, routes
│   ├── migrations/         Esquema SQL
│   ├── scripts/            create-admin, google-auth, drive-check
│   ├── certs/              CA do Aiven
│   └── tests/              Testes de integração
├── assets/
├── docs/
└── tests/                  Verificação de integridade
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
  "packageFileId": "1AbC...",
  "packageSize": 1073741824,
  "files": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Detalhes em `docs/database.md`.

---

## 6. Armazenamento

```text
{pasta raiz no Google Drive}/
└── session_{sessionId}/
    ├── session.zip
    ├── projeto.rpp
    ├── 01 Drums.wav
    └── README.txt
```

O ZIP é o pacote principal de download. Os arquivos individuais existem para consulta e
download opcional.

Os bytes dos arquivos **não passam pela API**: o backend cria a pasta e assina uma
URL de envio retomável, e o navegador envia direto para o Drive. Um pacote de
sessão pode ter gigabytes.

Detalhes em `docs/storage.md`.

---

## 7. Modo demonstração

Quando a API não responde, a aplicação entra em **modo demonstração**: o catálogo
é exibido com uma biblioteca local de exemplo e um aviso explícito de que os
dados não são reais.

O aviso é obrigatório. Sem ele o usuário acreditaria estar vendo a biblioteca
verdadeira.

---

## 8. Configuração

O passo a passo completo está em **`docs/setup.md`**. Resumo:

| Etapa | O que fazer |
|---|---|
| Banco | `backend/.env` com a senha do Aiven; `npm run migrate` |
| Drive | Credencial OAuth *App para computador*; `npm run google-auth` |
| Administrador | `npm run admin:create -- seu@email.com` |
| Backend | Publicar em um host Node gratuito |
| Frontend | Apontar `js/core/config.js` para o backend; ativar Pages |

### Segurança

Rotacione antes de tudo: a senha do banco e o `client_secret` do Google foram
compartilhados em texto plano durante o desenvolvimento. Trate ambos como
comprometidos.

---

## 9. Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` publica automaticamente a cada push na
`main`, após rodar a verificação de integridade.

Ative uma vez em **Settings > Pages > Source: GitHub Actions**.

O backend é publicado separadamente. Veja `docs/setup.md`.

---

## 10. Desenvolvimento

```bash
# Frontend
npm run serve          # servidor local em http://localhost:12000
npm run check          # verificação de integridade do projeto

# Backend
cd backend
npm install
npm run migrate        # aplica as migrações SQL
npm run migrate:status # lista o que falta
npm run db:check       # testa a conexão com o Aiven
npm run db:verify      # confere as restrições do banco
npm run admin:create   # cria um administrador
npm run drive:check    # confere a configuração do Drive
npm test               # testes de integração da API
npm start              # sobe a API em :8080
```

### Verificação automática

`npm run check` confere, sem depender de rede:

- imports resolvem e os símbolos importados existem
- não há declarações duplicadas
- toda classe usada pelo JavaScript tem estilo
- as páginas carregam módulos e seus assets existem
- nenhum arquivo de mídia foi versionado

No backend, `npm run db:verify` grava dados inválidos e espera que as restrições
do banco recusem. `npm test` exercita a API inteira contra o banco real, sem
mocks.

---

## 11. Segurança

A proteção é aplicada no **backend** e no **banco**, não na interface. A
existência de `admin.html` não autoriza ninguém.

```text
Aplicação pública    READ catálogo / download   → permitido
                     WRITE / DELETE             → negado

Administrador        READ / CREATE / UPDATE / DELETE / UPLOAD → permitido
(token de sessão)
```

As restrições do banco validam o **conteúdo** gravado: campos obrigatórios,
limites de tamanho, faixas numéricas e categorias de arquivo. Isso impede que um
registro válido seja gravado com valores arbitrários.

Detalhes em `docs/security.md`.

---

## 12. Privacidade dos Arquivos

```text
GitHub
   └── Código

Aiven            Google Drive
   └── Metadados     └── Arquivos de áudio
```

Os arquivos de áudio e os pacotes de sessão **não são armazenados no repositório
Git**. O `.gitignore` bloqueia as extensões de mídia, e a verificação de
integridade falha se alguma for versionada.

---

## 13. Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/setup.md` | Passo a passo de configuração |
| `docs/architecture.md` | Camadas, modos de operação, ordem de gravação |
| `docs/database.md` | Tabelas, campos, validação e consultas |
| `docs/storage.md` | Estrutura no Drive, envio e download |
| `docs/security.md` | Autorização, tokens, CORS e segredos |
| `docs/workflow.md` | Publicação, versionamento e manutenção |

---

## 14. Roadmap

### MVP

- [x] Catálogo: lista, busca, filtros e página da música
- [x] Modelos de dados e camada de acesso
- [x] Backend com Aiven PostgreSQL e Google Drive
- [x] Administração: visão geral, biblioteca e cadastro em 5 etapas
- [x] Upload de pacote e arquivos individuais direto para o Drive
- [x] Download do pacote completo com nome amigável
- [x] Autorização por token de sessão e validação no banco
- [x] Publicação no GitHub Pages

### Futuro

Favoritos, histórico de downloads, capa da música, busca avançada, filtros
combinados, estatísticas da biblioteca, validação de arquivos, visualização da
estrutura do pacote e backup.

---

## 15. Princípio Arquitetural

> **KyriosStems armazena e organiza sessões prontas; não modifica o conteúdo
> musical.**

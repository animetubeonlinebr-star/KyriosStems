# 1. OBJECTIVE

Construir do zero o **KyriosStems**, uma aplicação web estática (HTML5 + CSS3 + JavaScript Vanilla/ES Modules) hospedada no GitHub Pages, usando **Firebase** (Auth, Firestore e Storage) como backend, para catalogar músicas de louvor e armazenar/baixar **pacotes de sessões de DAW prontas** (ZIP).

A aplicação **não processa áudio**: ela apenas registra metadados (música + sessão), armazena os arquivos já preparados externamente e entrega o pacote completo para download, preservando a estrutura de pastas necessária para abrir o projeto na DAW.

O desenvolvimento deve ser executado em **etapas incrementais, com um novo push no GitHub ao final de cada etapa**.

---

# 2. CONTEXT SUMMARY

**Estado atual do workspace**
- `/workspace/project` é um repositório Git vazio: sem commits, sem remote configurado, sem arquivos de projeto.
- O repositório de destino `https://github.com/animetubeonlinebr-star/KyriosStems.git` retornou **404 na API do GitHub**, ou seja: ainda não existe (ou é privado). A Etapa 0 inclui confirmar isso antes de configurar o remote.

**Stack definida**
- Frontend: HTML5, CSS3, JavaScript ES Modules (sem React/Angular/Vue, sem build step, sem Node no servidor).
- Backend: Firebase Authentication (admin), Cloud Firestore (metadados), Firebase Storage (arquivos).
- Hospedagem: GitHub Pages (arquivos estáticos).

**Componentes do sistema**
- `Song` — item da biblioteca (título, artista, tom, BPM, compasso, categoria, tags, capa, descrição).
- `DawSession` — versão preparada para uma DAW (daw, dawVersion, version, formato, sampleRate, bitDepth, duração, packageUrl).
- Pacote da sessão (ZIP) — unidade principal de download, contendo `Project/`, `Audio/` e `README.txt`.

**Constraints técnicos relevantes**
1. **GitHub Pages é estático e serve o site em subpasta** (`https://<user>.github.io/KyriosStems/`). Portanto **todos os caminhos de assets devem ser relativos** (`./css/...`, nunca `/css/...`), e o site deve funcionar sem roteamento no servidor (`song.html?id=...`).
2. **ES Modules não funcionam via `file://`** — o desenvolvimento/teste local exige um servidor HTTP simples (ex.: `python3 -m http.server`).
3. **Firebase JS SDK via CDN** (`https://www.gstatic.com/firebasejs/<versão>/firebase-*.js`) para manter o projeto sem npm/build. As API keys do app web do Firebase são **públicas por design**; a proteção real vem das **Security Rules**.
4. **Firestore**: consultas com `where` + `orderBy` exigem índices compostos. Para uma biblioteca pessoal pequena, a estratégia é **buscar todas as músicas e filtrar/ordenar no cliente**, evitando índices e reduzindo complexidade.
5. **Cotas do plano Spark (gratuito)**: Firestore 1 GiB armazenado, 50k leituras/dia; Storage ~5 GB armazenados e **1 GB de download por dia**. Um único pacote de sessão multitrack (WAV 24-bit/48 kHz) pode ter centenas de MB — logo, poucos downloads podem estourar a franquia diária. Isso é uma **restrição de viabilidade a confirmar**, não um item de implementação.
6. **Segurança**: leitura pública de `songs`/`sessions` e dos arquivos; escrita/exclusão apenas para o admin autenticado, aplicado **nas Security Rules** (não apenas na UI). O repositório Git contém somente código — nunca arquivos de áudio.

---

# 3. APPROACH OVERVIEW

**Abordagem escolhida:** aplicação multipágina estática (MPA) em Vanilla JS, com uma camada fina de abstração sobre o Firebase (`js/firebase/*`), uma camada de serviços de domínio (`js/services/*`) e componentes de UI reutilizáveis (`js/components/*`). HTML/CSS cuidam da apresentação; os serviços encapsulam todo o acesso a Auth/Firestore/Storage.

**Por que:**
- Mantém compatibilidade total com GitHub Pages e com o requisito de não usar frameworks/build step.
- Separar `firebase/` (SDK) de `services/` (regras de negócio) permite trocar detalhes de persistência sem afetar as páginas e facilita testes manuais por etapa.
- Conteúdo renderizado no cliente a partir do Firestore permite catálogo, busca e filtros ricos sem índice composto e sem regenerar o site a cada música nova.

**Alternativas consideradas e descartadas:**
- *SPA com roteador próprio*: mais complexidade de roteamento em GitHub Pages (necessidade de truque de `404.html`) sem ganho real para 4 páginas.
- *Filtros/busca server-side no Firestore*: exigiria índices compostos e mais leituras; desnecessário para o volume esperado.
- *Firebase Hosting em vez de GitHub Pages*: o requisito é explicitamente GitHub Pages.

**Estratégia de entrega:** 11 etapas incrementais (Etapa 0 a Etapa 10), cada uma funcional e verificável de forma independente, **com commit + push no GitHub ao final de cada etapa** (Push 1 a Push 11).

---

# 4. IMPLEMENTATION STEPS

## Etapa 0 — Repositório, scaffold e convenções

**Goal:** ter o repositório remoto criado, vinculado e com o esqueleto do projeto versionado.
**Method:**
- Confirmar/criar o repositório no GitHub e configurar o remote `origin`.
- Criar `.gitignore` (ignorar `.DS_Store`, `firebase-debug.log`, arquivos de áudio locais de teste, `.agents_tmp/`), `.nojekyll` (garante que o Pages não processe via Jekyll) e `README.md` (título KYRIOS STEMS, subtítulo *Personal Worship Multitrack Library*, escopo, stack, links para `docs/`).
- Criar a árvore de diretórios exatamente conforme o spec §24: `css/`, `js/firebase/`, `js/models/`, `js/services/`, `js/components/`, `assets/{icons,images}`, `docs/` (com arquivos `.md` vazios/estruturais).
- Criar páginas placeholder (`index.html`, `login.html`, `song.html`, `admin.html`) apenas com o shell HTML e o `<script type="module">` correspondente — sem lógica ainda.
- Além dos arquivos listados em §24, o spec prevê um único `js/app.js`; para manter um entry point por página, serão criados também `js/song.js`, `js/login.js` e `js/admin.js` ao lado de `js/app.js` (mesmo diretório, sem `js/pages/`).
**Reference:** raiz do repo, `README.md`, `docs/`.

**Push 1:** `chore: scaffold inicial do projeto KyriosStems`

---

## Etapa 1 — Identidade visual, CSS base e layout compartilhado

**Goal:** estabelecer a base visual (tema escuro tipo DAW, discreto e profissional) reutilizada por todas as páginas.
**Method:**
- `css/variables.css`: tokens de cor, tipografia, espaçamento, raios e sombras (paleta escura "console de áudio", um accent único).
- `css/reset.css`: normalize/reset mínimo.
- `css/global.css`: layout base, header com marca KYRIOS STEMS + subtítulo, navegação (Catálogo / Admin), container, botões e estados de foco/hover.
- `css/components.css`: cards, badges (tom/BPM/DAW), tabelas, modais, stepper de wizard, campos de formulário, barra de progresso de upload, estados de carregamento/vazio/erro.
- Aplicar o layout às 4 páginas placeholder e criar `assets/favicon.ico` (placeholder simples).
**Reference:** `css/*`, `index.html`, `admin.html`, `login.html`, `song.html`.

**Push 2:** `feat(ui): design system base e layout compartilhado`

---

## Etapa 2 — Camada Firebase (config, SDK e wrappers)

**Goal:** inicializar o Firebase e expor APIs internas estáveis de Auth, Firestore e Storage.
**Method:**
- `js/firebase/config.js`: objeto `firebaseConfig` com os valores do projeto do usuário (placeholders claramente marcados se ainda não fornecidos) + constante `ADMIN_EMAILS`/`ADMIN_UIDS` usada pela UI.
- `js/firebase/app.js` (ou bloco em `config.js`): `initializeApp` + export do `app`, `getAuth`, `getFirestore`, `getStorage`.
- `js/firebase/auth.js`: `loginAdmin(email, senha)`, `logout()`, `onAuthChange(cb)`, `requireAdmin()` (protege `admin.html`).
- `js/firebase/firestore.js`: helpers `getCollection(name)`, `getDocById`, `addDoc`, `updateDoc`, `deleteDoc`, `queryWhere` — evitando espalhar chamadas do SDK pelas páginas.
- `js/firebase/storage.js`: `uploadWithProgress(path, file, onProgress)`, `getUrl(path)`, `deleteFile(path)`.
- `docs/firebase-setup.md`: passo a passo manual no console Firebase (criar projeto, habilitar Auth Email/Senha + criar usuário admin, criar Firestore, criar Storage).
**Reference:** `js/firebase/*`, `docs/firebase-setup.md`.

**Push 3:** `feat(firebase): inicialização do SDK e wrappers de auth, firestore e storage`

---

## Etapa 3 — Modelos de domínio e serviços de leitura

**Goal:** centralizar o formato dos dados e a leitura do catálogo.
**Method:**
- `js/models/song.js`: factory/normalizador de `Song` (defaults, conversão de `createdAt`/`updatedAt`, validação leve) — campos do spec §7.
- `js/models/daw-session.js`: factory de `DawSession` (campos do spec §8, incl. `version`, `dawVersion`, `format`, `sampleRate`, `bitDepth`, `duration`, `packageUrl`, `isCurrent`).
- `js/models/package.js`: helpers do pacote (nome sugerido `"{song} - {daw}.zip"`, formatação de tamanho, estrutura esperada `Project/`, `Audio/`, `README.txt`).
- `js/services/song-service.js`: `listSongs()`, `getSong(id)`, `createSong()`, `updateSong()`, `deleteSong()` (escrita será usada na Etapa 6; nesta etapa, apenas leitura + `seed` manual no console se necessário).
- `js/services/session-service.js`: `listSessionsBySong(songId)`, `getSession(id)`, `createSession()`, `updateSession()`, `deleteSession()`, `getCurrentSession(...)`, além de utilitário para marcar versão atual.
**Reference:** `js/models/*`, `js/services/*`.

**Push 4:** `feat(domain): modelos Song/DawSession e serviços de leitura`

---

## Etapa 4 — Catálogo público (index.html)

**Goal:** página principal funcionando como biblioteca, do spec §15.
**Method:**
- `js/components/search.js`: input de busca com debounce, filtrando por título/artista/tags.
- `js/components/filters.js`: selects de Artista, Tom, BPM, Categoria e DAW populados dinamicamente a partir das músicas carregadas; filtros combinados no cliente.
- `js/components/song-card.js`: card com título, artista, `Tom • BPM • DAWs disponíveis` e botão **VER SESSÃO**.
- `js/app.js`: entry point do catálogo (chamado por `index.html`), orquestra carregamento, aplicação de filtros, ordenação e estados de vazio/erro. Também expõe helpers de bootstrap compartilhados (render de header/estados).
- `css/catalog.css`: grid de cards, barra de filtros e responsividade.
**Reference:** `index.html`, `js/components/*`, `js/app.js`, `css/catalog.css`.

**Push 5:** `feat(catalog): catálogo com busca e filtros combinados`

---

## Etapa 5 — Página da música (song.html) e download

**Goal:** página detalhada com metadados, sessões e download do pacote completo (spec §11, §16, §12).
**Method:**
- Ler `?id=` da URL, carregar a música e suas sessões (via `session-service`), tratar ID inexistente com estado de erro amigável.
- `js/components/session-card.js`: mostra DAW, versão, `formato • bitDepth • sampleRate • tamanho`, badge de "atual" e botão **BAIXAR SESSÃO COMPLETA**; sessões antigas aparecem no bloco "Outras sessões".
- `js/services/download-service.js`: `downloadPackage(session)` (usa `packageUrl` + atributo `download` com nome `"{song} - {daw}.zip"`), `downloadFile(fileEntry)` e `downloadFileList(session)` quando houver manifesto de arquivos individuais.
- Listagem de arquivos individuais **somente se houver manifesto** (ver sub-etapa 8b, opcional) — caso contrário, a seção é omitida.
- `css/song.css`: layout da página, cabeçalho de metadados, tags, blocos de sessão.
- `js/song.js`: entry point da página (`song.html`).
**Reference:** `song.html`, `js/song.js`, `js/components/session-card.js`, `js/services/download-service.js`, `css/song.css`.

**Push 6:** `feat(song): página da música e download do pacote da sessão`

---

## Etapa 6 — Autenticação e login administrativo

**Goal:** proteger o painel administrativo (spec §25).
**Method:**
- `login.html` + `js/login.js`: formulário email/senha, mensagens de erro claras (sem vazar detalhes do Firebase), redirecionamento para `admin.html` em caso de sucesso.
- `admin.html`: guarda de rota usando `onAuthChange`/`requireAdmin()`; usuário não autenticado é redirecionado para `login.html`; usuário autenticado mas fora de `ADMIN_EMAILS`/`ADMIN_UIDS` recebe aviso e perde acesso às ações.
- `css/admin.css`: shell do admin (header, ações, área de conteúdo).
- `docs/security.md`: documentar o modelo de autorização (UI + regras) e deixar claro que `admin.html` existir **não** concede autorização.
**Reference:** `login.html`, `admin.html`, `js/login.js`, `js/firebase/auth.js`, `css/admin.css`.

**Push 7:** `feat(auth): login administrativo e proteção do painel`

---

## Etapa 7 — Painel administrativo: CRUD de músicas e sessões

**Goal:** gerenciar a biblioteca conforme spec §17 e §18 (etapas 1 a 3 e 5 do wizard; upload na Etapa 8).
**Method:**
- Dashboard em `admin.html`: contadores de Músicas, Sessões, Pacotes e Espaço utilizado (somatório de `packageSize`), botão **+ NOVA MÚSICA**. Contagem de sessões/pacotes e espaço calculados no cliente a partir das coleções.
- Wizard de cadastro em etapas (stepper visual): **1 Informações** → **2 Informações musicais** → **3 Sessão** → **4 Arquivos** (Etapa 8) → **5 Publicação** (resumo + PUBLICAR).
- Editor de música existente (editar/excluir com confirmação), listagem de músicas e de suas sessões no admin.
- Validação de formulário (campos obrigatórios, BPM numérico, compasso no padrão `n/d`, tags como lista).
**Reference:** `admin.html`, `js/admin.js`, `js/services/song-service.js`, `js/services/session-service.js`, `css/admin.css`.

**Push 8:** `feat(admin): dashboard e CRUD de músicas e sessões`

---

## Etapa 8 — Upload de arquivos para o Firebase Storage

**Goal:** enviar o pacote da sessão (e opcionalmente arquivos individuais) e persistir as URLs no Firestore (spec §19, §20).
**Method:**
- `js/services/upload-service.js`: 
  - upload principal do ZIP via `uploadBytesResumable` para `sessions/{songId}/{sessionId}/package/session.zip`, com callback de progresso e cancelamento;
  - geração do `sessionId` antes do upload (para montar o caminho);
  - rollback em caso de falha (remover arquivo órfão do Storage e/ou documento incompleto do Firestore);
  - gravação de `packageUrl`, `packageSize` e `storagePath` no documento da sessão.
- **Opcional (sub-etapa 8b):** upload do projeto (`.rpp`, `.als`, `.cpr`) para `project/` e dos WAVs para `audio/`, montando um manifesto `files: [{name, kind, storagePath, url, size}]` no documento da sessão — habilita os downloads individuais do spec §12. Se não for feito, o campo fica ausente e a UI omite a seção.
- Aceitar `.zip`, `.wav`, `.rpp`, `.als`, `.cpr` e afins; validar tamanho/tipo do arquivo; exibir barra de progresso, velocidade restante e estado de erro.
- Integrar o upload à Etapa 4 do wizard (Publicação só habilita após o pacote estar disponível).
**Reference:** `js/services/upload-service.js`, `js/admin.js`, `js/firebase/storage.js`.

**Push 9:** `feat(upload): envio do pacote da sessão para o Firebase Storage`

---

## Etapa 9 — Security Rules, versionamento e publicação

**Goal:** aplicar segurança real no backend, suportar versões de sessão e publicar o site.
**Method:**
- Criar `firestore.rules`: leitura pública em `songs` e `sessions`; `create`/`update`/`delete` somente quando `request.auth != null` e o `uid`/`email` do admin estiver na lista permitida (lista de UIDs; validação de formato dos dados de `Song`/`DawSession` nos `create`/`update`).
- Criar `storage.rules`: leitura pública em `sessions/**` (necessário para downloads), escrita/exclusão apenas para o admin autenticado, com validação de tipo/tamanho dos arquivos.
- Criar `firebase.json` (apontando para os arquivos de rules) + `docs/security.md` atualizado com instruções de deploy (`firebase deploy --only firestore:rules,storage` ou colagem manual no console).
- Versionamento (spec §14): garantir que ao publicar uma nova versão de sessão para a mesma `daw`, as anteriores permaneçam listadas com `isCurrent = false` e a mais recente como atual; histórico visível na página da música.
- Habilitar **GitHub Pages** (branch `main`, raiz) e validar o site publicado, confirmando que todos os caminhos relativos resolvem sob `/KyriosStems/`.
**Reference:** `firestore.rules`, `storage.rules`, `firebase.json`, `admin.html`, `song.html`.

**Push 10:** `feat(security): regras de segurança, versionamento e publicação`

---

## Etapa 10 — Documentação final e consolidação do MVP

**Goal:** fechar a documentação descrita no spec §24 e revisar o MVP do §28.
**Method:**
- Preencher `docs/architecture.md` (diagrama do §22), `docs/database.md` (coleções, campos, relacionamento Song→Sessions), `docs/storage.md` (árvore `sessions/{songId}/{sessionId}/...`), `docs/workflow.md` (preparação → upload → catálogo → download).
- Atualizar `README.md` com: descrição, stack, estrutura de repositório, como configurar o Firebase, como rodar localmente e como publicar, além da lista de itens **fora de escopo** (separação de stems, edição, mixagem, conversão entre DAWs).
- Revisar a checklist do MVP (§28) item a item e registrar o que ficou como "futuras funcionalidades" (§29).
**Reference:** `README.md`, `docs/*`.

**Push 11:** `docs: documentação final e consolidação do MVP`

---

# 5. TESTING AND VALIDATION

**Verificação por etapa (manual, ambiente controlado)**
1. **Local:** servir a raiz com `python3 -m http.server 8000` e abrir `http://localhost:8000/index.html`. A aplicação deve carregar sem erros de módulo/caminho no console.
2. **Publicado:** acessar `https://<user>.github.io/KyriosStems/` e confirmar que CSS, JS, imagens e fontes carregam com caminhos relativos (nenhum recurso em `/css/...` ou `/js/...`).

**Dados e fluxos**
3. **Catálogo:** com ao menos 2 músicas e 3 sessões cadastradas, a busca por título/artista/tag e cada filtro (Artista, Tom, BPM, Categoria, DAW) retornam o subconjunto correto, inclusive com filtros combinados; cenário sem resultados exibe estado vazio.
4. **Página da música:** `song.html?id=<songId>` mostra tom, BPM, compasso, tags e a lista de sessões com DAW, versão, formato, bit depth, sample rate e tamanho; ID inválido exibe erro amigável.
5. **Download principal:** o botão **BAIXAR SESSÃO COMPLETA** baixa `<Música> - <DAW>.zip`; ao extrair, a estrutura contém `Project/` (com o projeto da DAW), `Audio/` (WAVs nomeados) e `README.txt`, e o projeto abre na DAW de destino — as referências de áudio do projeto continuam resolvendo.
6. **Downloads individuais (se a sub-etapa 8b for implementada):** cada arquivo listado baixa individualmente e os nomes preservam a estrutura original; se não implementada, a seção não aparece na página.
7. **Admin - CRUD:** login com o usuário admin funciona; criar, editar e excluir música e sessão refletem no catálogo público; usuário não autenticado é redirecionado de `admin.html` para `login.html`.
8. **Upload:** enviar um ZIP pequeno de teste mostra progresso e conclusão; a sessão publicada fica disponível e baixável, com `packageSize` exibido no dashboard. Interromper/repetir um upload não deixa documento de sessão sem pacote.
9. **Versionamento:** publicar duas versões para a mesma DAW resulta na segunda marcada como atual e a primeira acessível em "Outras sessões".

**Segurança (validação das regras, não apenas da UI)**
10. No console do navegador, autenticado como não-admin (ou anônimo), tentar `addDoc` em `songs`, `updateDoc`/`deleteDoc` em documento existente e upload em `sessions/...` — todas devem falhar com `permission-denied`.
11. Confirmar leitura pública: sem autenticação, o catálogo e o download do pacote funcionam.
12. Confirmar que `.gitignore` impede versionamento de arquivos de áudio e que o repositório contém apenas código.

**Critério de sucesso final (MVP §28)**
- Catálogo com lista, busca e filtros por artista/tom/BPM/DAW funcionando.
- Página detalhada da música com download da sessão completa operacional.
- Login admin + cadastro/edição/exclusão de música e sessão + upload de ZIP no Firebase Storage.
- Site publicado no GitHub Pages, com Security Rules ativas em Firestore e Storage, e documentação em `docs/`.

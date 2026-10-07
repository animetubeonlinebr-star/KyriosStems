# AGENTS.md

Conhecimento do repositório para sessões de trabalho futuras.

## O que é

KyriosStems: biblioteca pessoal de sessões musicais de louvor prontas para DAW.
Aplicação **100% estática** (HTML5 + CSS3 + JavaScript ES Modules, sem build),
publicada no GitHub Pages. **Sem servidor, sem login, sem banco de dados.**

**Princípio inegociável:** o sistema armazena e organiza sessões prontas; não
processa áudio. Nada de separação de stems, edição, mixagem ou conversão.

## Arquitetura

```text
Google Drive (pasta pública por link)
   │  API key pública, SOMENTE LEITURA
   ▼
GitHub Pages (estático)
```

A **estrutura de pastas no Drive é a fonte da verdade**. Não há banco para
sincronizar: pasta de primeiro nível = música; subpasta = sessão; o nome da
pasta é o rótulo. Um `song.json` opcional acrescenta metadados.

Escrever no Drive exigiria OAuth; por isso **a aplicação só lê**. A biblioteca é
alimentada arrastando pastas no Drive — decisão deliberada desta etapa.

## Comandos

```bash
npm run serve     # http://localhost:12000
npm run check     # verificação de integridade (rápida, sem rede)
```

## Estrutura

```text
index.html song.html
css/    variables reset global components catalog song
js/
  core/         config (Drive), constants, dom, format, async
  models/       song, daw-session
  repositories/ drive-repository
  services/     library-service, download-service
  components/   app-header, search, filters, song-card, session-card
  pages/        catalog, song
  ui/           icons, toast, modal
  data/         demo-data
exemplo/  song.json (modelo comentado)
tests/    check-project.js
```

Dependências sempre fluem página → serviço → repositório. Uma página nunca fala
com a API do Drive diretamente.

## Convenções

- Comentários em português; código em inglês.
- Comentar só o que é não óbvio: invariantes, ordem de operações, decisões de
  projeto. Não narrar o diff nem repetir o código.
- `el()` em `js/core/dom.js` é o único construtor de elementos. Texto sempre por
  `textContent`; não existe prop de HTML bruto (era vetor de XSS).
- Toda classe CSS usada pelo JavaScript precisa existir em `css/`. O
  `npm run check` falha se faltar.
- Toda operação de rede passa por `withTimeout` (`js/core/async.js`).

## Armadilhas conhecidas

### `npm run check` não detecta erro de sintaxe nem campo renomeado

Ele valida imports, símbolos, classes e assets — não o corpo das funções. Nesta
migração, um `fileId: ,` (sintaxe inválida) e referências a `packagePath`
(campo renomeado) passaram pelo check sem alarde. **Ao renomear campo ou mexer em
expressões, valide os módulos de verdade:**

```bash
for f in $(find js -name "*.js"); do
  node --input-type=module -e "await import('file://$PWD/$f').catch(()=>{})" 2>&1 | grep -i syntaxerror
done
```

### Módulos ES não carregam por `file://`

A origem é `null` e o navegador bloqueia. Abra sempre por HTTP
(`npm run serve`). O sintoma é página em branco — por isso os HTMLs têm estado
inicial pré-renderizado (spinner, breadcrumb), que aparece mesmo quando o módulo
falha.

### A leitura degrada para dados de demonstração

Quando o Drive falha, o repositório devolve a biblioteca de demonstração **junto
com o erro**, e a interface é obrigada a avisar (`renderNotices`). Nunca remova
esse aviso: sem ele o usuário acredita estar vendo a biblioteca real.

São dois avisos distintos, de propósito: "não configurada" (exige preencher
`js/core/config.js`) e "falhou" (pede tentar de novo). Têm ações diferentes.

### A API key é pública

Ela vai no JavaScript e identifica a aplicação, não o usuário. O que protege é a
**restrição por sites** no Google Cloud. Sem ela, qualquer site consome a cota.

### O download público depende do link

Cada arquivo é servido por link. Se a pasta deixar de ser pública, o catálogo
continua listando (a listagem usa a API key) mas o download falha.

## Sem cadastro e sem Firebase

Não há login, contas nem banco. O Firebase existiu apenas para sustentar uma
tela temporária de cadastro que já foi **removida**: o site abre direto no
catálogo (`index.html`) e a biblioteca continua sendo lida do Drive.

A remoção seguiu o roteiro que ficava no README: `catalogo.html` voltou a ser
`index.html`, apagou-se `css/cadastro.css`, `js/pages/cadastro.js` e
`js/firebase/`, e ajustaram-se `js/core/constants.js`, `tests/check-project.js`
e o workflow do Pages. Se algum dia a tela voltar, não grave senha, hash ou
token no Firestore: o repositório é público e tudo que o navegador grava fica
visível.

## Estado atual

Aplicação completa e funcional. Falta apenas configuração de conta:

1. Compartilhar a pasta da biblioteca no Drive como "qualquer pessoa com o link"
2. Ativar a Drive API e criar uma API key restrita por sites
3. Preencher `driveApiKey` e `driveRootFolderId` em `js/core/config.js`

Enquanto (1)–(3) não estiverem prontos, o catálogo mostra a biblioteca de exemplo
com o aviso de que a biblioteca ainda não foi conectada.

## Fluxo de trabalho do repositório

Um push por etapa concluída. Mensagens de commit descritivas, em português,
explicando o porquê e não apenas o quê.

## Histórico

Este repositório passou por duas arquiteturas antes desta, ambas preservadas:

| Branch | Arquitetura | Por que saiu |
|---|---|---|
| `backend-aiven-drive-legacy` | Backend Node + Aiven PostgreSQL + Drive | GitHub Pages não executa servidor |
| `arquitetura-estatica-drive` (PR #2) | Estático + Firebase + OAuth do Drive | Exigia Firebase, rules e cliente OAuth; mais configuração que o necessário |
| Etapa atual | Estático + Drive, sem Firebase | A tela de cadastro (Firebase Auth/Firestore) foi removida; não havia login na arquitetura |

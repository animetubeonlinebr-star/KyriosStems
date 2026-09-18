# AGENTS.md

Conhecimento do repositório para sessões de trabalho futuras.

## O que é

KyriosStems: biblioteca pessoal de sessões musicais de louvor prontas para DAW.
Aplicação **estática** (HTML5 + CSS3 + JavaScript ES Modules, sem build) hospedada
no GitHub Pages, com Firebase (Auth, Firestore, Storage) como backend.

**Princípio inegociável:** o sistema armazena e organiza sessões prontas; não
processa áudio. Nada de separação de stems, edição, mixagem ou conversão.

## Comandos

```bash
npm install
npm run serve          # http://localhost:12000
npm run check          # verificação de integridade (rápida, sem rede)
npm run test:rules     # testes das Security Rules no emulador
npm run deploy:rules   # publica as rules
npm run admin:grant -- email@exemplo.com
```

## Estrutura

```text
index.html song.html login.html admin.html
css/    variables reset global components catalog song admin
js/
  core/         constants, dom, format, async
  firebase/     config, app, auth
  models/       song, daw-session
  repositories/ firestore-repository, storage-repository
  services/     library-service, download-service, publish-service
  components/   app-header, search, filters, song-card, session-card
  pages/        catalog, song, login, admin
  ui/           icons, toast, modal
  data/         demo-data
tests/    check-project.js, rules.test.js
docs/     architecture, database, storage, security, workflow
scripts/  grant-admin.js
firestore.rules storage.rules firebase.json .firebaserc
```

Dependências sempre fluem página → serviço → repositório. Uma página nunca fala
com o Firestore diretamente.

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

### O Firestore não rejeita leitura offline

Em dispositivo offline, `getDocs` **não rejeita**: repete com backoff. Sem limite
de tempo a interface fica carregando para sempre. Foi um bug real. Sempre use
`withTimeout` com os limites de `NETWORK` em `js/core/constants.js`.

### `node --check` não detecta declaração duplicada

Um `createId` declarado duas vezes em `js/core/format.js` quebrava a página
inteira e passava no `--check`. `npm run check` detecta isso avaliando os
módulos de verdade. Rode antes de commitar.

### O atributo `download` é ignorado entre domínios

As URLs do Storage vêm de outro domínio, então o navegador pode salvar como
`session.zip` em vez do nome amigável. Resolver exigiria URL assinada via Cloud
Function — o que contraria a proposta estática. Documentado em `docs/storage.md`.

### A leitura degrada para dados de demonstração

Quando o Firestore falha, o repositório devolve a biblioteca de demonstração
**junto com o erro**. A interface é obrigada a avisar (`renderNotices`). Nunca
remova esse aviso: sem ele o usuário acredita estar vendo a biblioteca real.

### Ordem de gravação na publicação

`publishSession` grava música → arquivos → sessão. Os arquivos vêm antes de
registrar a sessão para que uma falha de upload não deixe uma sessão vazia
apontando para arquivos inexistentes.

## Segurança

- Autorização por custom claim `admin` no token, verificada nas rules.
- `admin.html` não autoriza ninguém; a verificação no frontend só evita mostrar
  interface inútil.
- `js/firebase/config.js` tem a apiKey versionada **de propósito**: chaves do SDK
  Web são públicas. O que protege são as rules e a restrição de domínio.
- Nunca versionar `serviceAccount.json` (já no `.gitignore`).
- As rules validam conteúdo: campos permitidos, obrigatórios, tamanhos e faixas.

## Estado atual

MVP completo no código. Falta no console do Firebase:

1. Criar o banco do Firestore (API desabilitada)
2. Ativar o Storage (bucket não existe)
3. Ativar Authentication e-mail/senha e criar o usuário
4. Conceder a custom claim `admin`
5. Publicar as rules (`npm run deploy:rules`)
6. Ativar Pages em Settings > Pages > Source: GitHub Actions

## Fluxo de trabalho do repositório

Um push por etapa concluída. Mensagens de commit descritivas, em português,
explicando o porquê e não apenas o quê.

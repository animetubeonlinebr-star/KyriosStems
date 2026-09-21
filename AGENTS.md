# AGENTS.md

Conhecimento do repositório para sessões de trabalho futuras.

## O que é

KyriosStems: biblioteca pessoal de sessões musicais de louvor prontas para DAW.
Frontend **estático** (HTML5 + CSS3 + JavaScript ES Modules, sem build) no
GitHub Pages, e um **backend próprio** que guarda os metadados no Aiven
PostgreSQL e os arquivos no Google Drive.

**Princípio inegociável:** o sistema armazena e organiza sessões prontas; não
processa áudio. Nada de separação de stems, edição, mixagem ou conversão.

```text
GitHub Pages (estático)
        │ HTTPS + token de sessão
        ▼
Backend (Node, sem framework)
        ├──► Aiven PostgreSQL   metadados
        └──► Google Drive       WAV, ZIP, projeto da DAW
```

## Comandos

```bash
# Frontend
npm run serve            # http://localhost:12000
npm run check            # verificação de integridade (rápida, sem rede)

# Backend (tudo em backend/)
cd backend
npm install
npm run migrate          # aplica as migrações SQL
npm run migrate:status   # lista o que falta
npm run db:check         # testa a conexão com o Aiven
npm run db:verify        # confere as restrições do banco
npm run admin:create -- email@exemplo.com
npm run drive:check      # confere a configuração do Drive
npm test                 # testes de integração da API
npm start                # sobe a API em :8080
```

## Estrutura

```text
index.html song.html login.html admin.html
css/    variables reset global components catalog song admin
js/
  core/         constants, config, dom, format, async
  api/          client (HTTP + sessão), auth
  models/       song, daw-session
  repositories/ library-repository, file-repository
  services/     library-service, download-service, publish-service
  components/   app-header, search, filters, song-card, session-card
  pages/        catalog, song, login, admin
  ui/           icons, toast, modal
  data/         demo-data
backend/
  src/
    config.js env.js
    auth/       passwords (scrypt), tokens (HMAC)
    db/         pool, migrate, mappers, songs, sessions, admins
    drive/      client (API REST do Drive)
    http/       router, respond, handler
    lib/        files (classificação e nomes)
    routes/     auth, songs, drive
  migrations/   001_init.sql
  scripts/      create-admin, google-auth, drive-check
  certs/        aiven-ca.pem
  tests/        api.test.js
tests/    check-project.js
docs/     architecture, database, storage, security, workflow, setup
```

Dependências sempre fluem página → serviço → repositório → API. Uma página nunca
fala com a API diretamente.

## Convenções

- Comentários em português; código em inglês.
- Comentar só o que é não óbvio: invariantes, ordem de operações, decisões de
  projeto. Não narrar o diff nem repetir o código.
- `el()` em `js/core/dom.js` é o único construtor de elementos. Texto sempre por
  `textContent`; não existe prop de HTML bruto (era vetor de XSS).
- Toda classe CSS usada pelo JavaScript precisa existir em `css/`. O
  `npm run check` falha se faltar.
- Toda operação de rede passa por `withTimeout` (`js/core/async.js`) e por
  `request()` (`js/api/client.js`) no frontend.
- O backend não usa framework. O roteador é próprio; a API tem poucas rotas.
- Nenhum segredo tem valor padrão no backend: variável ausente derruba a
  inicialização, em vez de cair para um valor de desenvolvimento.

## Armadilhas conhecidas

### A validação de conteúdo vive no banco, não na API

O que as Security Rules do Firestore validavam hoje são restrições `CHECK` em
`backend/migrations/001_init.sql`. A validação no banco é a última linha de
defesa: vale mesmo que um erro na API deixe passar um valor inválido. Ao mudar um
limite, mude os dois lugares e rode `npm run db:verify`, que grava dados
inválidos e espera erro.

### Os bytes dos arquivos não passam pela API

O backend cria a pasta e assina uma URL de envio retomável; o navegador envia
direto para o Drive. Um pacote de sessão pode ter gigabytes: atravessar a API
somaria latência e esbarraria no limite de corpo da requisição. Não "simplifique"
isso fazendo o backend receber o arquivo.

### A ordem de exclusão importa

Os arquivos saem do Drive **antes** do registro no banco. Se o Drive falhar, a
música continua existindo e pode ser tentada de novo; o contrário deixaria
arquivos órfãos ocupando cota, sem referência para encontrá-los. Por isso a
exclusão devolve 502 quando o Drive não responde — é o comportamento correto,
não um bug.

### A leitura degrada para dados de demonstração

Quando a API falha, o repositório devolve a biblioteca de demonstração **junto
com o erro**. A interface é obrigada a avisar (`renderNotices`). Nunca remova
esse aviso: sem ele o usuário acredita estar vendo a biblioteca real.

### O TLS do Aiven exige a CA do projeto

A Project CA do Aiven é autoassinada, então o repositório de CAs do sistema não
a reconhece. O arquivo `backend/certs/aiven-ca.pem` é **público** (certificado,
não chave) e precisa ser versionado. Desativar a verificação
(`rejectUnauthorized: false`) não é alternativa: exporia a senha do banco a um
intermediário na rede.

### O OAuth do Google Drive precisa de uma conta dedicada

O backend guarda um refresh token e o troca por access token. A conta de serviço
não serve para uma pasta no "Meu Drive" de uma conta comum: ela não é dona da
pasta. O cliente OAuth precisa ser do tipo **App para computador** — um cliente
do tipo "Web" exigiria cadastrar a URI de redirecionamento antes de funcionar.

## Segurança

- Autorização decidida pela API, por token de sessão assinado (HMAC-SHA256).
  A interface só evita mostrar o que não funcionaria.
- Senha em scrypt, com os parâmetros gravados junto ao hash.
- Comparação de senha e de assinatura em tempo constante.
- O login verifica a senha mesmo quando o e-mail não existe, para que o tempo de
  resposta não revele quais e-mails estão cadastrados.
- CORS restrito às origens configuradas em `KYRIOS_ALLOWED_ORIGINS`. `*`
  permitiria que qualquer site usasse a API com as credenciais do usuário.
- O nome amigável do download é reduzido a um nome de arquivo seguro antes de
  entrar no `Content-Disposition`: quebra de linha ali permitiria injetar
  cabeçalhos na resposta.
- Nunca versionar `backend/.env`. A CA do Aiven **é** versionada, de propósito.

## Estado atual

Frontend, backend e publicação no Pages prontos. O site está no ar em
`https://animetubeonlinebr-star.github.io/KyriosStems/` (Pages ativo, build por
GitHub Actions). Falta configurar as contas:

1. `backend/.env` com a senha do Aiven (rotacionada) e um `KYRIOS_JWT_SECRET`
2. Credencial OAuth (App para computador) e `npm run google-auth`
3. Pasta raiz no Drive, compartilhada com a conta dedicada
4. `npm run admin:create` para criar o administrador
5. Publicar o backend em um host gratuito e apontar `js/core/config.js`

Enquanto o passo 5 não acontecer, `js/core/config.js` aponta para
`http://localhost:8080` e o site publicado cai no modo demonstração. Não é bug:
o frontend não tem para onde falar. O mesmo vale para `KYRIOS_ALLOWED_ORIGINS`,
que precisa incluir o domínio do Pages além do localhost.

## Testar o backend sem o Aiven

`npm test` exige banco real e credenciais do Drive. Para rodar tudo localmente
sem tocar em produção, suba um PostgreSQL com TLS:

- O pool sempre exige `ssl.ca` com verificação (`backend/src/db/pool.js`), então
  o servidor precisa de certificado próprio. Gere uma CA local, sirva
  `server.crt`/`server.key` no contêiner e aponte `KYRIOS_DB_CA_PATH` para a CA
  local no `.env`.
- Os testes criam dados `test_%` e os removem no fim; o Drive é simulado, e as
  credenciais do Drive podem ser valores quaisquer em `test:api`.

Verificado nesta base: 37 casos em `api.test.js` e 28 em `drive-flow.test.js`,
todos passando, e `db:verify` recusando os 13 casos inválidos.

## Fluxo de trabalho do repositório

Um push por etapa concluída. Mensagens de commit descritivas, em português,
explicando o porquê e não apenas o quê.

Pull requests: branch com o trabalho, PR para `main`, merge só depois de revisar.
O PR #1 (`backend-aiven-drive`) foi mergeado assim.

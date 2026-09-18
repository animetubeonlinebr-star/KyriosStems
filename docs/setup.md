# Configuração

Passo a passo para colocar o KyriosStems no ar. O código já está pronto; falta
ligar as contas.

---

## Antes de começar: rotacione o que foi exposto

A senha do banco e o `client_secret` do Google foram compartilhados em texto
plano durante o desenvolvimento. Trate os dois como comprometidos:

1. **Senha do Aiven** — no console do Aiven, em *Users*, redefina a senha de
   `avnadmin`.
2. **Client secret do Google** — no Google Cloud Console, em *APIs e serviços >
   Credenciais*, regenere o segredo.

Os valores novos vão **apenas** para `backend/.env`, que não é versionado.

---

## 1. Banco de dados

A instância no Aiven já existe e está vazia. O esquema é criado pelas migrações.

```bash
cd backend
npm install
cp .env.example .env
```

Preencha `backend/.env`:

```text
KYRIOS_DB_HOST=kyrios-animetubeonlinebr-kyrios-stems.f.aivencloud.com
KYRIOS_DB_PORT=25580
KYRIOS_DB_NAME=defaultdb
KYRIOS_DB_USER=avnadmin
KYRIOS_DB_PASSWORD=<a senha rotacionada>
KYRIOS_JWT_SECRET=<gerado abaixo>
```

Gere o segredo do token:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

A Project CA já está versionada em `backend/certs/aiven-ca.pem`. Ela é um
certificado público, não uma chave — e é o que permite validar o TLS em vez de
desativar a verificação.

Aplique o esquema e confira:

```bash
npm run db:check     # testa a conexão
npm run migrate      # cria as tabelas
npm run db:verify    # confere que as restrições recusam dados inválidos
```

---

## 2. Google Drive

### 2.1 Crie uma conta dedicada

Recomendado: uma conta Google só para o KyriosStems, não a sua pessoal. Se um dia
precisar revogar o acesso, você revoga o acesso da biblioteca sem afetar o resto.

Entre nessa conta e crie uma pasta, por exemplo `KyriosStems`.

### 2.2 Ative a Drive API

No [Google Cloud Console](https://console.cloud.google.com), em *APIs e serviços
> Biblioteca*, procure por **Google Drive API** e ative.

Recomendado: um projeto dedicado ao KyriosStems. Reutilizar um projeto que já
serve outra aplicação mistura cotas, telas de consentimento e permissões.

### 2.3 Crie a credencial OAuth

Em *APIs e serviços > Credenciais > Criar credenciais > ID do cliente OAuth*:

| Campo | Valor |
|---|---|
| Tipo de aplicativo | **App para computador** |
| Nome | KyriosStems Backend |

O tipo importa. Um cliente do tipo **Web** exigiria cadastrar a URI de
redirecionamento antes de funcionar; o tipo **App para computador** usa
redirecionamento para `localhost` sem cadastro prévio.

Se a tela de consentimento ainda não estiver configurada, o console vai pedir:
escolha **Externo** e preencha o mínimo. Enquanto o app não for verificado, o
Google mostra um aviso — use *Avançado > Acessar*.

### 2.4 Obtenha o refresh token

Copie o `client_id` e o `client_secret` para `backend/.env`:

```text
KYRIOS_DRIVE_CLIENT_ID=<client_id>
KYRIOS_DRIVE_CLIENT_SECRET=<client_secret>
```

E rode:

```bash
npm run google-auth
```

O script abre a URL de consentimento, recebe a resposta em `localhost` e grava o
refresh token no `.env`. **Entre com a conta dedicada**, não a pessoal. Ele
também pergunta a pasta raiz — cole a URL da pasta criada em 2.1.

### 2.5 Confirme

```bash
npm run drive:check
```

O script valida a troca do refresh token, o acesso à pasta raiz e a permissão de
escrita (cria e remove uma pasta de teste).

---

## 3. Administrador

```bash
npm run admin:create -- seu@email.com
```

A senha é lida do terminal sem eco. Depois de criada, entre em `login.html` com
esse e-mail e senha.

---

## 4. Rodar localmente

Duas janelas:

```bash
# terminal 1 — API
cd backend
npm start

# terminal 2 — frontend
npm run serve
```

Abra `http://localhost:12000`.

O frontend aponta para `http://localhost:8080` por padrão. Para apontar para
outro endereço em desenvolvimento, crie `js/core/config.local.js`:

```js
export const apiBaseUrl = 'http://localhost:8080';
```

Esse arquivo não é versionado.

---

## 5. Publicar

### 5.1 Backend

O backend precisa de um host que rode Node. Opções gratuitas compatíveis:

| Host | Observação |
|---|---|
| Render | Plano gratuito hiberna após inatividade |
| Railway | Crédito inicial; verifique o plano atual |
| Fly.io | Pequena cota gratuita |

Configure as variáveis de ambiente do `.env` no painel do host. **Não** faça
deploy do arquivo `.env`.

O host precisa permitir conexão de saída na porta 25580 (Aiven) e para
`googleapis.com` (Drive).

### 5.2 Frontend

Edite `js/core/config.js` com o endereço público do backend:

```js
export const apiBaseUrl = 'https://seu-backend.exemplo.com';
```

Depois, no GitHub, em *Settings > Pages > Source*, escolha **GitHub Actions**. O
workflow publica a cada push na `main`.

### 5.3 CORS

Atualize `KYRIOS_ALLOWED_ORIGINS` no host do backend para incluir o domínio do
Pages:

```text
KYRIOS_ALLOWED_ORIGINS=https://usuario.github.io,http://localhost:12000
```

Sem isso o navegador bloqueia as chamadas, e o catálogo cai no modo
demonstração.

---

## Verificar se funcionou

| Sintoma | Causa provável |
|---|---|
| Catálogo com "Modo demonstração" | API fora do ar ou CORS sem o domínio |
| "API: falha na leitura" no painel | Mesma causa acima |
| Login recusa | Administrador não criado, ou senha incorreta |
| Upload falha com 403 | Pasta do Drive não compartilhada como Editor |
| `drive:check` falha com `invalid_grant` | Refresh token de outra conta ou revogado |
| `db:check` falha com erro de certificado | CA ausente ou de outro projeto Aiven |

---

## Depois de configurado

Ferramentas de verificação, todas sem efeito colateral:

```bash
npm run check                      # integridade do frontend
cd backend
npm run db:check                   # conexão com o Aiven
npm run db:verify                  # restrições do banco
npm run drive:check                # configuração do Drive
npm test                           # API de ponta a ponta
```

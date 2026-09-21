# Segurança

## Princípio

A segurança é aplicada no **backend** e no **banco**, não na interface. A
existência de `admin.html` não autoriza ninguém: mesmo que alguém contorne o
redirecionamento do frontend, as rotas de escrita recusam e as restrições do
banco rejeitam conteúdo inválido.

```text
Aplicação pública    READ catálogo e download        → permitido
                     WRITE / DELETE                  → negado (401)

Administrador        READ / CREATE / UPDATE / DELETE → permitido
(token de sessão)
```

### Por que a segurança saiu do cliente

Antes, as Security Rules do Firestore decidiam quem podia escrever. Agora a
decisão é do backend, que é o único com acesso ao banco. Isso é mais forte: o
navegador não tem credencial nenhuma do banco nem do Drive, apenas um token de
sessão que a API emite e verifica.

## Autorização

O acesso administrativo é um registro em `admin_users`, com a senha em hash. O
login devolve um token de sessão assinado.

### Senha: scrypt

```text
scrypt$N$r$p$salt$hash
```

Os parâmetros ficam gravados junto ao hash, para que o custo possa subir depois
sem invalidar as senhas existentes. A verificação compara em tempo constante: um
`===` vazaria informação pelo tempo de resposta, permitindo descobrir o hash byte
a byte.

O login verifica a senha **mesmo quando o e-mail não existe**, com um hash
descartável. Sem isso, o tempo de resposta revelaria quais e-mails estão
cadastrados.

### Token: HMAC-SHA256

```text
base64url(payload).base64url(assinatura)
```

Não é um JWT completo de propósito: sem cabeçalho com algoritmo negociável, não
existe o ataque de confundir o verificador sobre qual algoritmo usar. A
verificação é sempre HMAC-SHA256 com o segredo do servidor, e a comparação da
assinatura também é em tempo constante.

O token é stateless e expira (`KYRIOS_TOKEN_TTL`, padrão 12 horas). Sair do
painel apenas descarta o token no navegador; para revogar de fato, troque o
administrador ou o segredo.

### Criar um administrador

```bash
cd backend
npm run admin:create -- seu@email.com
```

Sem `--password`, a senha é lida do terminal sem eco, para não ficar no histórico
do shell nem aparecer na lista de processos.

## Regras do banco

O que as Security Rules validavam agora são restrições `CHECK` em
`backend/migrations/001_init.sql`:

- campos obrigatórios (`NOT NULL`)
- limites de tamanho em todos os textos
- faixas numéricas: BPM entre 20 e 400, sample rate entre 8000 e 384000
- categorias de arquivo restritas às quatro previstas
- unicidade de `(song_id, daw, version)`

A validação no banco é a última linha de defesa: vale mesmo que um erro na API
deixe passar um valor inválido.

```bash
npm run db:verify
```

O script grava dados inválidos e espera erro. Se algum passar, a validação foi
afrouxada sem que ninguém percebesse.

## CORS

`KYRIOS_ALLOWED_ORIGINS` é uma lista explícita. Usar `*` permitiria que qualquer
site chamasse a API com as credenciais do usuário logado.

Em produção, inclua o domínio do GitHub Pages:

```text
KYRIOS_ALLOWED_ORIGINS=https://usuario.github.io,http://localhost:12000
```

## Download

O download é público por padrão (`KYRIOS_PUBLIC_DOWNLOAD=true`), acompanhando o
comportamento anterior: o catálogo é público e o download é o propósito do
sistema. A pasta no Drive continua privada — quem entrega os bytes é o backend.

Se a biblioteca deixar de ser pública, defina `KYRIOS_PUBLIC_DOWNLOAD=false` e o
download passa a exigir o token.

## Cabeçalhos

O nome amigável do download entra no `Content-Disposition`. O valor é reduzido a
um nome de arquivo seguro antes disso: quebra de linha em um valor de cabeçalho
permite injetar cabeçalhos arbitrários na resposta (response splitting), e o nome
vem de um parâmetro da URL.

## Segredos

Nunca versionar:

| Arquivo | Motivo |
|---|---|
| `backend/.env` | Senha do banco, segredo do token, refresh token do Drive |
| `js/core/config.local.js` | Sobreposições locais |
| `.env`, `.env.*` | Variáveis de ambiente |

O `.gitignore` cobre esses caminhos.

**Exceção deliberada:** `backend/certs/aiven-ca.pem` **é** versionado. É um
certificado público, não uma chave. A CA do Aiven é autoassinada, então o
repositório de CAs do sistema não a reconhece; sem o arquivo a conexão falha, e a
alternativa seria desativar a verificação de TLS — o que exporia a senha do banco
a um intermediário na rede.

## Limitação conhecida

Nem o banco nem a API inspecionam o **conteúdo** dos arquivos enviados: eles vão
direto para o Drive. Um administrador poderia enviar um arquivo com qualquer
conteúdo. Como só há um administrador — o dono da biblioteca — esse risco é
aceito. Se houvesse múltiplos administradores, seria necessário validar no
servidor.

## Aplicar as migrações

```bash
cd backend
npm run migrate
npm run db:verify
```

## Testar

```bash
cd backend
npm test
```

Os testes cobrem o que deve ser permitido e, o mais importante, o que deve ser
negado: escrita sem token, token forjado, senha incorreta, valores fora de faixa,
versão duplicada e sessão de música inexistente.

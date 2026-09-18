# Segurança

## Princípio

A segurança é aplicada nas **Security Rules** do Firestore e do Storage, não na
interface. A existência de `admin.html` não autoriza ninguém: mesmo que alguém
contorne o redirecionamento do frontend, o Firestore e o Storage recusam a
escrita.

```text
Aplicação pública    READ songs / sessions / arquivos   → permitido
                     WRITE / DELETE                     → negado

Administrador        READ / CREATE / UPDATE / DELETE    → permitido
(custom claim admin)
```

## Autorização: custom claim

O acesso administrativo é concedido por uma custom claim no token do usuário:

```json
{ "admin": true }
```

A claim é verificada nas rules:

```javascript
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

O frontend usa a mesma claim apenas para não exibir uma interface que não
funcionaria — nunca como mecanismo de proteção.

### Conceder a claim

A claim não pode ser definida pelo SDK Web. Use o SDK Admin em Node:

```bash
# 1. Gere uma chave de serviço no console do Firebase:
#    Configurações do projeto > Contas de serviço > Gerar nova chave privada
#    Salve como serviceAccount.json (NUNCA versione este arquivo)

# 2. Conceda a claim
node scripts/grant-admin.js seu@email.com
```

O script `scripts/grant-admin.js` acompanha o projeto. Para revogar, use
`node scripts/grant-admin.js seu@email.com --revoke`.

Depois de conceder, o usuário precisa entrar novamente para o token ser emitido
com a claim.

## Regras do Firestore

Arquivo: `firestore.rules`

### Validação de conteúdo

As rules não verificam apenas quem escreve, mas também **o que** é escrito:

- campos permitidos por documento (`hasOnly`), impedindo gravação de campos
  arbitrários como `isAdmin: true` dentro de uma música
- campos obrigatórios (`hasAll`)
- limites de tamanho em todos os textos
- faixas numéricas: BPM entre 20 e 400, sample rate entre 8000 e 384000
- tamanho máximo das listas de tags e arquivos

A validação roda sobre o documento resultante, então cobre criação e atualização
inclusive parcial — não há caminho para contornar os limites alterando um único
campo.

### Caminhos negados

Qualquer caminho fora de `songs` e `sessions` é negado explicitamente:

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

## Regras do Storage

Arquivo: `storage.rules`

- leitura pública, porque o catálogo e o download são o propósito do sistema
- escrita e exclusão exigem a claim `admin`
- apenas as quatro categorias previstas são aceitas
- o caminho precisa ter exatamente a profundidade esperada
- arquivos vazios e acima de 2 GiB são recusados

## Chaves do Firebase

A `apiKey` no repositório é **pública por natureza** — o SDK Web é embarcado no
navegador. Ela não é um segredo; serve para identificar o projeto, não para
autorizar.

O que protege os dados:

1. As Security Rules
2. A restrição da chave de API por domínio

### Restringir a chave

No Google Cloud Console, em *APIs e serviços > Credenciais*, edite a chave e
limite os domínios autorizados ao GitHub Pages e a `localhost` durante o
desenvolvimento. Isso impede que a chave seja usada a partir de outros sites.

## Segredos

Nunca versionar:

| Arquivo | Motivo |
|---|---|
| `serviceAccount.json` | Chave privada do SDK Admin |
| `js/firebase/config.local.js` | Sobreposições locais |
| `.env`, `.env.*` | Variáveis de ambiente |

O `.gitignore` já cobre esses caminhos.

## Limitação conhecida

As rules não conseguem validar o **conteúdo** dos arquivos enviados: o Storage
não inspeciona bytes. Um administrador poderia enviar um arquivo com qualquer
conteúdo. Como só há um administrador — o dono da biblioteca — esse risco é
aceito. Se houvesse múltiplos administradores, seria necessário validar no
servidor.

## Aplicar as rules

```bash
firebase login
firebase use kyriosstems
firebase deploy --only firestore:rules,storage
```

Ou pelo console do Firebase, colando o conteúdo dos arquivos.

## Testar as rules

```bash
npm run test:rules
```

Os testes rodam contra o emulador e cobrem o que deve ser permitido e, o mais
importante, o que deve ser negado: escrita anônima, usuário autenticado sem a
claim, campos não previstos, valores fora de faixa e caminhos inválidos no
Storage.
# KyriosStems

### Personal Worship Multitrack Library

**Biblioteca pessoal de sessões de louvor prontas para DAW.**

Aplicação **100% estática**. Roda inteiramente no navegador, publicada no GitHub
Pages, **sem servidor e sem login**. Os arquivos vivem no seu Google Drive e os
metadados são lidos da própria estrutura de pastas.

---

## Como funciona

```text
Google Drive (sua pasta, compartilhada por link)
   │
   │  API key pública, só leitura
   ▼
GitHub Pages (HTML + CSS + JavaScript, sem build)
```

Nada para hospedar, nada para manter, custo zero. O Drive é a fonte da verdade:
**organizar a biblioteca é organizar pastas**.

> **Princípio inegociável:** o KyriosStems armazena e organiza sessões prontas;
> não processa áudio. Nada de separar stems, editar, mixar ou converter. O
> processamento acontece na DAW.

---

## Estrutura da pasta no Drive

```text
KyriosStems/                      ← compartilhada como "qualquer pessoa com o link"
│
├── Vim Para Adorar-te/           ← uma pasta por música (o nome é o título)
│   ├── song.json                 ← metadados opcionais
│   ├── capa.jpg                  ← capa opcional
│   └── REAPER/                   ← uma subpasta por sessão (nome = DAW)
│       ├── session.zip           ← pacote principal
│       ├── projeto.rpp
│       └── 01 Drums.wav
│
└── Oceans/
    ├── song.json
    ├── REAPER/
    │   └── session.zip
    └── Ableton Live/
        └── session.zip
```

| Onde | Vira o quê |
|---|---|
| Pasta de primeiro nível | Uma música. O nome da pasta é o título. |
| Subpasta | Uma sessão. O nome da pasta é o rótulo da DAW. |
| `session.zip` | O pacote principal do download. |
| Demais arquivos | Catalogados por extensão (projeto, áudio, auxiliar). |
| `song.json` | Metadados que o nome da pasta não carrega. |
| `capa.jpg` / `cover.png` | Capa da música. |

A categoria de cada arquivo vem da extensão: `.zip`/`.rar`/`.7z` são pacote;
`.rpp`/`.als`/`.cpr`/`.logicx` são projeto; `.wav`/`.flac`/`.mp3` são áudio; o
resto é auxiliar.

### Metadados opcionais

Sem `song.json`, o nome da pasta já produz um resultado útil. Com ele, você
acrescenta o que quiser. Há um modelo comentado em `exemplo/song.json`:

```json
{
  "title": "Vim Para Adorar-te",
  "artist": "Adoração e Adoradores",
  "album": "Ao Vivo",
  "key": "E",
  "bpm": 72,
  "timeSignature": "4/4",
  "category": "Louvor",
  "tags": ["adoração", "lento"],
  "description": "Sessão completa com guia e click.",
  "sessions": {
    "REAPER": { "dawVersion": "7.x", "format": "WAV", "sampleRate": 48000, "bitDepth": 24 }
  }
}
```

A chave em `sessions` é o **nome exato da subpasta**. Os campos sobrepõem o que
foi inferido da pasta.

---

## Configuração

Duas coisas, uma vez só.

### 1. Compartilhe a pasta no Drive

Botão direito na pasta → **Compartilhar** → em *Acesso geral*, escolha
**Qualquer pessoa com o link** → *Leitor*.

### 2. Ative a Drive API e crie a API key

No [Google Cloud Console](https://console.cloud.google.com):

1. *APIs e serviços > Biblioteca*: ative a **Google Drive API**
2. *APIs e serviços > Credenciais > Criar credenciais > Chave de API*
3. **Restrinja a chave** (*Restrições de aplicativo > Sites*):

```text
http://localhost:12000
https://SEU-USUARIO.github.io
```

A restrição não é opcional na prática: a API key é pública (vai no JavaScript) e
sem ela qualquer site poderia consumir a sua cota.

4. Em `js/core/config.js`, preencha:

```js
export const driveApiKey = 'sua-api-key';
export const driveRootFolderId = 'id-da-pasta';   // trecho final da URL no Drive
```

Pronto. O catálogo lê a pasta e monta a biblioteca.

---

## Desenvolvimento

```bash
npm run serve     # http://localhost:12000
npm run check     # verificação de integridade (sem rede)
```

Abra sempre por `http://localhost:12000`, nunca por `file://`: módulos ES não
carregam por `file://` (a origem é `null` e o navegador bloqueia).

### Verificação automática

`npm run check` confere, sem depender de rede:

- imports resolvem e os símbolos importados existem
- não há declaração duplicada
- toda classe usada pelo JavaScript tem estilo
- as páginas carregam módulos e seus assets existem
- nenhum arquivo de mídia foi versionado

---

## Modo demonstração

Enquanto `js/core/config.js` não estiver preenchido — ou se a leitura do Drive
falhar — o catálogo usa uma biblioteca de exemplo e **avisa que os dados não são
reais**. O aviso é obrigatório: sem ele o usuário acreditaria estar vendo a
biblioteca verdadeira.

---

## Limitações conhecidas

| Limitação | Por quê |
|---|---|
| **Não há cadastro pelo app** | Escrever no Drive exige autorização OAuth. A biblioteca é alimentada arrastando pastas no Drive. |
| **A biblioteca é pública** | Quem tiver o link da pasta acessa. É o preço de não haver servidor entregando os bytes. |
| **O nome do download nem sempre é o amigável** | O atributo `download` é ignorado entre domínios; o arquivo vem do Drive. |

---

## Dependências externas

| Serviço | Papel | Custo |
|---|---|---|
| GitHub Pages | Publicar o site estático | gratuito |
| Google Drive | Guardar os arquivos | gratuito até 15 GB |
| Google Drive API | Listar e baixar | gratuito (com cota) |

---

## Tela temporária de cadastro

> **Esta tela deve ser removida.** Ela existe apenas para criar contas e não faz
> parte da arquitetura: a biblioteca continua sendo lida do Drive, sem login.

O site abre na raiz (`index.html`), que hoje é a tela de cadastro de
**e-mail e senha**. O catálogo fica em `catalogo.html`. A senha **não é
gravada por esta aplicação**: ela vai para o Firebase Authentication, que guarda
apenas o hash com salt e nunca a devolve. No Firestore fica só o e-mail e a
data, para a tela listar quem foi cadastrado.

### Por que a senha não vai para um banco nosso

A aplicação é estática e o repositório é **público**. Qualquer coisa que o
navegador grave fica visível para qualquer visitante — uma tabela de senhas ali
seria lida por qualquer pessoa, e um hash exposto é alvo de quebra offline.
Por isso a senha é delegada a um serviço que existe para isso.

### Configurar

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication > Sign-in method**: ative **E-mail/senha**
3. **Firestore Database**: crie o banco
4. **Configurações do projeto > Seus apps > Web**: copie os valores para
   `js/firebase/config.js`
5. Publique as Security Rules abaixo

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cadastros/{doc} {
      // Criação livre: é o que a tela de cadastro precisa.
      allow create: if request.resource.data.keys().hasOnly(['email', 'createdAt'])
                    && request.resource.data.email is string
                    && request.resource.data.email.size() <= 320
                    && request.resource.data.createdAt is string;
      // Leitura pública APENAS enquanto a tela temporária existir.
      // Ao removê-la, troque por: allow read, write: if false;
      allow read: if true;
      allow update, delete: if false;
    }
  }
}
```

### Remover a tela temporária

Quando não precisar mais dela:

1. Troque os nomes: `catalogo.html` volta a ser `index.html`
2. Apague `css/cadastro.css`, `js/pages/cadastro.js` e `js/firebase/`
3. Em `js/core/constants.js`, aponte `catalog` de volta para `'index.html'`
4. Em `tests/check-project.js`, tire `catalogo.html` da lista `PAGES`
5. No `.github/workflows/pages.yml`, troque `catalogo.html` por nada no `cp -r`
6. Publique a regra `allow read, write: if false;` no Firestore
7. **Apague as contas criadas**, em Authentication > Users

O último passo importa: remover a tela não apaga os cadastros.


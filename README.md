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

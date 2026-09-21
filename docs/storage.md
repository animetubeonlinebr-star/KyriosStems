# Armazenamento

## Estrutura no Google Drive

```text
{pasta raiz do KyriosStems}/
└── session_{sessionId}/
    ├── session.zip
    ├── projeto.rpp
    ├── 01 Drums.wav
    └── README.txt
```

A pasta da sessão é criada sob a pasta raiz configurada em
`KYRIOS_DRIVE_FOLDER_ID`. A pasta é reaproveitada se já existir: o Drive aceita
nomes repetidos, então sem a busca cada publicação criaria uma pasta nova com o
mesmo nome.

A categoria de cada arquivo é derivada da extensão, conforme
`EXTENSION_CATEGORY` em `js/core/constants.js`. Não há escolha manual: a extensão
já diz o que o arquivo é.

| Categoria | Extensões |
|---|---|
| `package` | `.zip`, `.rar`, `.7z` |
| `project` | `.rpp`, `.als`, `.cpr`, `.song`, `.ptx`, `.flp`, `.bwproject`, `.ardour`, `.logicx` |
| `audio` | `.wav`, `.aif`, `.aiff`, `.flac`, `.mp3` |
| `aux` | Todo o resto |

## O pacote principal

O ZIP é sempre gravado como `session.zip`, mesmo que o arquivo escolhido tenha
outro nome. Isso mantém o nome estável e evita que títulos musicais virem nome de
arquivo.

Quando há mais de um ZIP no envio, o maior é tratado como pacote principal e os
demais vão para `aux`. O usuário não precisa decidir qual é o pacote.

## Envio

Os bytes **não passam pela API**. Um pacote de sessão pode ter gigabytes;
atravessar a API somaria latência, consumiria memória do processo e esbarraria no
limite de corpo da requisição.

```text
Navegador                     Backend                  Google Drive
    │                            │                          │
    │ POST /api/drive/prepare    │                          │
    ├───────────────────────────►│                          │
    │                            │ cria a pasta da sessão   │
    │                            ├─────────────────────────►│
    │                            │ assina URL de envio      │
    │◄───────────────────────────┤                          │
    │ { folderId, uploads[] }    │                          │
    │                                                       │
    │ PUT no uploadUrl (bytes direto, retomável)            │
    ├──────────────────────────────────────────────────────►│
    │◄──────────────────────────────────────────────────────┤
    │ { id }                                                │
    │                                                       │
    │ POST /api/sessions (com os ids do Drive)              │
    ├───────────────────────────►│                          │
```

O envio é sequencial, não paralelo. Isso evita saturar a conexão do usuário e
mantém a barra de progresso coerente.

O frontend usa `XMLHttpRequest` em vez de `fetch` porque só o XHR informa
progresso de envio. Sem isso a barra ficaria parada durante todo o upload de um
pacote grande — justamente quando o usuário mais precisa de retorno.

O limite é de 2 GiB por arquivo (`UPLOAD_LIMITS.maxFileBytes`), verificado antes
do envio.

## Download

O download do pacote completo é o fluxo principal:

1. `preparePackageDownload` valida que existe pacote
2. a API resolve a URL do arquivo e o nome amigável
3. `startDownload` dispara o download

Os arquivos individuais são um extra opcional e só aparecem se tiverem sido
catalogados na publicação.

### Nome do arquivo no download

A pasta no Drive é privada e os bytes são entregues pelo backend, que aplica o
nome amigável no cabeçalho `Content-Disposition`. Isso resolve a limitação que
existia no Firebase Storage, onde o atributo `download` era ignorado entre
domínios e o navegador salvava como `session.zip`.

O nome vem por parâmetro na URL e é reduzido a um nome de arquivo seguro antes de
entrar no cabeçalho: uma quebra de linha ali permitiria injetar cabeçalhos na
resposta.

O backend também repassa `Content-Length`, `Content-Range` e `Accept-Ranges`,
para que um download grande interrompido continue de onde parou em vez de
recomeçar.

## Cota

Os arquivos ocupam o espaço da conta Google que hospeda a biblioteca. A cota
gratuita é compartilhada com o resto do Drive, então o valor exibido no painel
(`STORAGE_QUOTA_BYTES`) é ordem de grandeza, não medição.

## Limpeza

| Ação | Efeito |
|---|---|
| Excluir sessão | Remove os arquivos e a pasta da sessão, depois o registro |
| Excluir música | Remove todas as sessões e todos os arquivos |

A remoção no Drive acontece **antes** da remoção do registro. Se o Drive falhar,
a música continua existindo e pode ser tentada de novo; o contrário deixaria
arquivos órfãos ocupando cota, sem referência para encontrá-los depois.

Quando o Drive não responde, a exclusão devolve erro e não remove nada. É o
comportamento correto, não uma falha.

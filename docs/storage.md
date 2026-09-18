# Armazenamento

## Estrutura

```text
sessions/
└── {songId}/
    └── {sessionId}/
        ├── package/
        │   └── session.zip
        ├── project/
        │   └── projeto.rpp
        ├── audio/
        │   ├── 01 Drums.wav
        │   └── 02 Bass.wav
        └── aux/
            └── README.txt
```

A pasta é derivada da extensão do arquivo, conforme `EXTENSION_CATEGORY` em
`js/core/constants.js`. Não há escolha manual de categoria: a extensão já diz o
que o arquivo é.

| Categoria | Extensões |
|---|---|
| `package` | `.zip`, `.rar`, `.7z` |
| `project` | `.rpp`, `.als`, `.cpr`, `.song`, `.ptx`, `.flp`, `.bwproject`, `.ardour`, `.logicx` |
| `audio` | `.wav`, `.aif`, `.aiff`, `.flac`, `.mp3` |
| `aux` | Todo o resto |

## O pacote principal

O ZIP é sempre gravado como `session.zip`, mesmo que o arquivo escolhido tenha
outro nome. Isso mantém o caminho estável e evita que títulos musicais virem
caminho de arquivo.

Quando há mais de um ZIP no envio, o maior é tratado como pacote principal e os
demais vão para `aux`. O usuário não precisa decidir qual é o pacote.

O nome amigável do download (`Vim Para Adorar-te - REAPER - v2.zip`) é montado
no momento do download por `packageFileName`.

## Estrutura interna do pacote

O ZIP preserva a estrutura que a DAW espera encontrar:

```text
Vim Para Adorar-te/
├── Project/
│   └── Vim Para Adorar-te.rpp
├── Audio/
│   ├── 01 Drums.wav
│   ├── 02 Bass.wav
│   └── 03 Guitar.wav
└── README.txt
```

O KyriosStems **não interpreta** o conteúdo do projeto. Ele armazena e devolve o
arquivo como recebido. Por isso o campo `path` de cada arquivo guarda o caminho
relativo dentro do pacote, separado do `storagePath`.

## Envio

```text
Arquivo escolhido
      │
      ▼
Classificação por extensão
      │
      ▼
uploadBytesResumable (sequencial)
      │
      ▼
URL de download + registro no Firestore
```

O envio é sequencial, não paralelo. Isso evita saturar a conexão do usuário e
mantém a barra de progresso coerente.

O limite é de 2 GiB por arquivo (`UPLOAD_LIMITS.maxFileBytes`), o mesmo valor
verificado em `storage.rules`.

## Download

O download do pacote completo é o fluxo principal:

1. `preparePackageDownload` valida que existe pacote
2. `resolvePackageUrl` obtém a URL do Storage
3. `startDownload` dispara o download com o nome amigável

Os arquivos individuais são um extra opcional e só aparecem se tiverem sido
catalogados na publicação.

### Nome do arquivo no download

O atributo `download` é ignorado em URLs de origem cruzada, e as URLs do
Firebase Storage vêm de outro domínio. Na prática, o navegador pode salvar com o
nome do objeto no Storage (`session.zip`) em vez do nome amigável. Nesse caso o
nome ainda deixa claro o que é, e o conteúdo é o correto.

Para forçar o nome exato, seria necessário gerar uma URL assinada com
`response-content-disposition` via Cloud Function — o que introduziria um
componente de servidor, contrariando a proposta estática do projeto.

## Limpeza

| Ação | Efeito |
|---|---|
| Excluir sessão | Remove os arquivos da sessão e o documento |
| Excluir música | Remove todas as sessões e todos os arquivos |

A remoção no Storage acontece antes da remoção do documento, para que uma falha
não deixe arquivos órfãos ocupando espaço sem referência.
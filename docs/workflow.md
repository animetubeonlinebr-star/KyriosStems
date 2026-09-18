# Fluxo de trabalho

## Preparação (fora do KyriosStems)

A música é preparada externamente, em uma DAW:

```text
Música original
      │
      ▼
Processamento externo (separação, edição, mixagem)
      │
      ▼
DAW
      ├── WAVs
      ├── Projeto
      └── Arquivos auxiliares
      │
      ▼
Pacote ZIP
```

O KyriosStems não participa dessa etapa. Ele recebe o resultado final.

## Publicação

```text
Pacote pronto
      │
      ▼
/admin.html → Nova música
      │
      ├── 1. Informações    nome, intérprete, álbum, categoria, tags
      ├── 2. Música         tom, BPM, compasso, duração
      ├── 3. Sessão         DAW, versão, formato, sample rate, bit depth
      ├── 4. Arquivos       ZIP e/ou arquivos individuais
      └── 5. Publicação     resumo e confirmação
      │
      ▼
Gravação: música → arquivos → sessão
```

A ordem de gravação importa. Veja `docs/architecture.md`.

## Recuperação

```text
KyriosStems
      │
      ▼
Pesquisar e filtrar no catálogo
      │
      ▼
Página da música
      │
      ▼
Baixar sessão completa
      │
      ▼
Extrair ZIP
      │
      ▼
Abrir o projeto na DAW
```

## Nova versão de uma sessão

Para publicar uma revisão:

1. Abra a biblioteca no painel
2. Use a ação de editar a música
3. Informe a DAW correta e um novo número de versão
4. Envie o pacote revisado
5. Publique

A versão anterior permanece disponível no histórico da página da música. A maior
versão de cada DAW é marcada como atual.

Se a versão for deixada em branco, a API calcula a próxima a partir das sessões
existentes daquela DAW.

## Múltiplas DAWs

A mesma música pode ter sessões para DAWs diferentes. Cada sessão é independente:
tem o próprio pacote, a própria versão e o próprio histórico.

```text
Oceans
├── REAPER
│   ├── v2  (atual)
│   └── v1
├── Ableton Live
│   └── v1
└── Cubase
    └── v1
```

## Exclusão

| Ação | Remove |
|---|---|
| Excluir sessão | Arquivos e pasta da sessão no Drive, depois o registro |
| Excluir música | Todas as sessões e todos os arquivos |

Ambas exigem confirmação explícita e são irreversíveis.

Se o Drive não responder, a exclusão é recusada e nada é removido. Isso é
intencional: remover o registro antes dos arquivos deixaria arquivos órfãos
ocupando cota, sem referência para encontrá-los depois.

## Manutenção

### Verificar a integridade do frontend

```bash
npm run check
```

Confere imports, símbolos, classes de estilo, assets das páginas e ausência de
arquivos de mídia versionados. Roda no CI antes de cada publicação.

### Verificar as restrições do banco

```bash
cd backend
npm run db:verify
```

### Testar a API

```bash
cd backend
npm test
```

### Estado das migrações

```bash
cd backend
npm run migrate:status
```

## Publicação do site

O workflow `.github/workflows/pages.yml` publica automaticamente a cada push na
`main`, após rodar a verificação de integridade do frontend.

Apenas os arquivos da aplicação vão para o site. Testes, backend e documentação
ficam de fora.

O backend é publicado separadamente, em um host próprio. Veja `docs/setup.md`.

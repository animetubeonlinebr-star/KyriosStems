# Arquitetura

## Visão geral

O KyriosStems tem duas partes: um frontend estático no GitHub Pages e um backend
próprio. O navegador não fala com o banco nem com o Google Drive — fala apenas
com a API.

```text
                    ┌─────────────────┐
                    │  GitHub Pages   │
                    │ HTML5/CSS3/JS   │
                    └────────┬────────┘
                             │ HTTPS + token de sessão
                             ▼
                    ┌─────────────────┐
                    │    Backend      │
                    │  Node, sem      │
                    │  framework      │
                    └───┬─────────┬───┘
                        │         │
              ┌─────────▼──┐   ┌──▼──────────────┐
              │   Aiven    │   │  Google Drive   │
              │ PostgreSQL │   │                 │
              │            │   │  ├── ZIP        │
              │ METADADOS  │   │  ├── WAV        │
              └────────────┘   │  └── Projeto    │
                               └─────────────────┘
```

### Por que existe um backend

O navegador não consegue falar com o PostgreSQL: não há driver `pg` no navegador,
e embarcar a senha do banco no JavaScript significaria que qualquer visitante
poderia apagar a biblioteca. O backend é o guardião de dois segredos — a senha do
banco e o refresh token do Drive — e o único que decide quem pode escrever.

## Design system

Tema escuro, definido em `css/variables.css`. As cores foram extraídas das
referências visuais em `Designe/` (`telas_desktop.jpg` e `telas_Mobile.jpg`).

| Papel | Cor | Uso |
|---|---|---|
| Fundo | `#0D1114` | Fundo da página |
| Superfície | `#1D2225` | Cartões e painéis |
| Superfície interna | `#161B1E` | Blocos dentro de cartões |
| Realce | `#262C30` | Estado de interação |
| Borda | `#2A3135` | Divisores e contornos |
| Texto | `#E3E8EB` | Texto principal |
| Texto secundário | `#9AA4AA` | Apoio |
| Acento | `#4153D3` | Ações principais |

A profundidade vem das três superfícies, não de sombra: no escuro uma sombra
pesada sujaria o fundo. As sombras existem apenas para modais e toasts.

Todas as cores passam por tokens. Há uma verificação que reprova cor fixa fora
de `variables.css`, para o tema não se fragmentar.

## Divisão de responsabilidades

| Camada | Pasta | Papel |
|---|---|---|
| Núcleo | `js/core` | Constantes, endereço da API, DOM, formatação, limites de rede |
| API | `js/api` | Cliente HTTP, sessão e autenticação |
| Modelos | `js/models` | `Song` e `DawSession`: validação e mapeamento |
| Repositórios | `js/repositories` | Acesso à API: biblioteca e arquivos |
| Serviços | `js/services` | Regras da biblioteca, download e publicação |
| Componentes | `js/components` | Peças de interface reutilizáveis |
| Páginas | `js/pages` | Controladores de cada página |
| Interface | `js/ui` | Ícones, toasts, modais |

A direção das dependências é sempre de cima para baixo nessa tabela. Uma página
não conhece a API; ela fala com um serviço, que fala com um repositório.

No backend:

| Camada | Pasta | Papel |
|---|---|---|
| Configuração | `src/config.js`, `src/env.js` | Leitura do ambiente |
| Autenticação | `src/auth` | Hash de senha e token de sessão |
| Banco | `src/db` | Pool, migrações, mapeamento e acesso |
| Drive | `src/drive` | Cliente REST do Google Drive |
| HTTP | `src/http` | Roteador, respostas e tratamento de erro |
| Domínio | `src/lib` | Classificação e nomes de arquivo |
| Rotas | `src/routes` | auth, songs, drive |

## Por que não há framework

Nem no frontend nem no backend. A aplicação não tem etapa de build: os módulos
são carregados diretamente pelo navegador, o que mantém a publicação simples e o
resultado auditável. O backend tem poucas rotas, e um roteador próprio mantém a
superfície pequena — a mesma razão nos dois lados.

## Modos de operação

| Situação | Comportamento |
|---|---|
| API respondendo | Dados reais |
| API indisponível ou recusando | Dados de demonstração **e aviso visível** |

O aviso é obrigatório: sem ele, o usuário acreditaria estar vendo a biblioteca
real. Está em `renderNotices` no catálogo e na página da música.

## Limites de tempo

Toda operação de rede passa por `withTimeout` (`js/core/async.js`). Uma
requisição sem resposta deixaria a interface carregando indefinidamente, sem
dizer o que está acontecendo. O envio de arquivos usa um limite próprio, muito
maior, porque um pacote grande demora de forma legítima.

## Ordem de gravação na publicação

`publishSession` grava na ordem: música, arquivos, sessão.

A música precisa existir antes porque a sessão a referencia e porque a pasta no
Drive é criada a partir dela. O envio dos arquivos acontece **antes** de
registrar a sessão: se falhar no meio, o pior caso é uma música sem sessões —
que o usuário completa depois. O contrário deixaria uma sessão vazia na
biblioteca apontando para arquivos inexistentes, e o download quebraria.

## Estrutura do pacote

O ZIP é gravado sempre como `session.zip`, independentemente do nome escolhido
na interface. Isso mantém o nome estável no Drive e evita que títulos com
caracteres especiais virem caminho de arquivo. O nome amigável é aplicado no
momento do download.

Cada arquivo catalogado guarda dois identificadores distintos:

- `fileId` — o arquivo no Google Drive
- `path` — caminho relativo dentro do pacote, exibido na página da música

## Verificação

`tests/check-project.js` confere, sem depender de rede:

- imports resolvem e os símbolos importados existem
- não há declarações duplicadas de topo
- toda classe usada pelo JavaScript tem estilo
- as páginas carregam módulos e seus assets existem
- nenhum arquivo de mídia foi versionado

No backend, `npm run db:verify` grava dados inválidos e espera que as restrições
do banco recusem, e `npm test` exercita a API inteira contra o banco real.

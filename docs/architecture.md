# Arquitetura

## Visão geral

O KyriosStems é uma aplicação estática hospedada no GitHub Pages. Não há
servidor de aplicação: o navegador fala diretamente com o Firebase.

```text
                    ┌─────────────────┐
                    │   GitHub Pages  │
                    │ HTML5/CSS3/JS   │
                    └────────┬────────┘
                             │ Firebase SDK
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
       Firebase Auth     Firestore       Firebase Storage
            │                │                │
         ADMIN           METADADOS         ARQUIVOS
                             │                ├── ZIP
                             ▼                ├── WAV
                         CATÁLOGO             ├── Projeto
                             │                └── Auxiliares
                             ▼
                         DOWNLOAD
```

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
| Núcleo | `js/core` | Constantes, DOM, formatação, limites de rede |
| Firebase | `js/firebase` | Configuração, inicialização e autenticação |
| Modelos | `js/models` | `Song` e `DawSession`: validação e mapeamento |
| Repositórios | `js/repositories` | Acesso a Firestore e Storage |
| Serviços | `js/services` | Regras da biblioteca, download e publicação |
| Componentes | `js/components` | Peças de interface reutilizáveis |
| Páginas | `js/pages` | Controladores de cada página |
| Interface | `js/ui` | Ícones, toasts, modais |

A direção das dependências é sempre de cima para baixo nessa tabela. Uma página
não conhece o Firestore; ela fala com um serviço, que fala com um repositório.

## Por que não há framework

A aplicação não tem etapa de build. Os módulos são carregados diretamente pelo
navegador, o que mantém a publicação simples e o resultado auditável. O custo é
que a manipulação de DOM é manual, o que está concentrado em `js/core/dom.js`.

## Carregamento do Firebase

O SDK é carregado do CDN por `import()` dinâmico, apenas quando a configuração
está preenchida. Sem isso, nenhum recurso de rede é usado e a aplicação opera em
modo demonstração.

## Modos de operação

| Situação | Comportamento |
|---|---|
| Configuração com valores de exemplo | Modo demonstração, sem rede |
| Firestore indisponível ou negando leitura | Dados de demonstração **e aviso visível** |
| Firestore respondendo | Dados reais |

O aviso é obrigatório: sem ele, o usuário acreditaria estar vendo a biblioteca
real. Está em `renderNotices` no catálogo e na página da música.

## Limites de tempo

O Firestore, quando o dispositivo está offline, **não rejeita** a leitura: ele
repete com backoff. Sem limite de tempo, a interface ficaria carregando
indefinidamente. Por isso toda operação de rede passa por `withTimeout`
(`js/core/async.js`), com os limites em `NETWORK` (`js/core/constants.js`).

## Ordem de gravação na publicação

`publishSession` grava na ordem: música, arquivos, sessão.

O envio dos arquivos acontece **antes** de registrar a sessão. Se o upload
falhar no meio, o pior caso é uma música sem sessões — que o usuário completa
depois. O contrário deixaria uma sessão vazia na biblioteca apontando para
arquivos inexistentes, e o download do pacote quebraria.

## Estrutura do pacote

O ZIP é gravado sempre como `session.zip`, independentemente do nome escolhido
na interface. Isso mantém o caminho no Storage estável e evita que títulos com
caracteres especiais virem caminho de arquivo. O nome amigável é aplicado no
momento do download.

Cada arquivo catalogado guarda dois caminhos distintos:

- `storagePath` — onde o arquivo está no Storage
- `path` — caminho relativo dentro do pacote, exibido na página da música

## Verificação

`tests/check-project.js` confere, sem depender de rede:

- imports resolvem e os símbolos importados existem
- não há declarações duplicadas de topo
- toda classe usada pelo JavaScript tem estilo
- as páginas carregam módulos e seus assets existem
- nenhum arquivo de mídia foi versionado

`tests/rules.test.js` exercita as Security Rules contra o emulador, cobrindo o
que deve ser permitido e o que deve ser negado.
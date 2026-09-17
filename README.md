# KYRIOS STEMS

### Personal Worship Multitrack Library

**Repositório pessoal de sessões musicais de louvor preparadas para utilização em DAWs.**

---

## 1. Visão Geral

O **KyriosStems** é uma aplicação web pessoal destinada ao armazenamento, organização,
catalogação e download de músicas de louvor preparadas para produção musical em uma DAW.

O sistema **não realiza separação de stems, edição de áudio, mixagem, processamento ou
conversão de arquivos**. Todo o processamento musical acontece externamente, utilizando
ferramentas como uma DAW, ferramentas de separação de áudio, FFmpeg ou outros softwares.

O KyriosStems recebe os arquivos já preparados e os organiza em uma biblioteca. O objetivo
principal é permitir que uma sessão musical seja armazenada e posteriormente baixada como um
pacote completo, contendo o projeto da DAW e todos os arquivos de áudio necessários para
abri-lo corretamente.

---

## 2. Conceito Principal

```text
MÚSICA
   │
   ├── Informações musicais
   │
   └── SESSÕES DAW
          │
          ├── Projeto da DAW
          ├── Arquivos WAV
          ├── Arquivos auxiliares
          └── Pacote completo
```

Uma música pode possuir uma ou mais sessões. Exemplo:

```text
Vim Para Adorar-te
│
├── REAPER
│   ├── v2  (atual)
│   └── v1  (histórico)
│
└── Ableton Live
    └── v1
```

---

## 3. Arquitetura

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

O frontend é estático e não requer build. O Firebase é carregado dinamicamente pelo CDN
apenas quando configurado.

---

## 4. Estrutura do Repositório

```text
kyrios-stems/
├── index.html              Catálogo (biblioteca)
├── song.html               Página da música
├── css/
│   ├── variables.css       Identidade visual (tokens)
│   ├── reset.css
│   ├── global.css
│   ├── components.css
│   ├── catalog.css
│   ├── song.css
│   └── admin.css
├── js/
│   ├── core/               Constantes, DOM e formatação
│   ├── firebase/           Configuração e inicialização do SDK
│   ├── models/             Song e DawSession
│   ├── repositories/       Acesso a Firestore e Storage
│   ├── services/           Regras da biblioteca e download
│   ├── components/         Cartões, busca, filtros, cabeçalho
│   ├── pages/              Controladores das páginas
│   ├── ui/                 Ícones, toasts, modais
│   └── data/               Biblioteca de demonstração
├── assets/
└── docs/
```

---

## 5. Modelo de Dados

### Song

```json
{
  "id": "song_001",
  "title": "Vim Para Adorar-te",
  "artist": "Adoração e Adoradores",
  "key": "E",
  "bpm": 72,
  "timeSignature": "4/4",
  "category": "Louvor",
  "tags": ["adoração", "lento"],
  "coverUrl": "",
  "description": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### DawSession

```json
{
  "id": "session_001",
  "songId": "song_001",
  "daw": "REAPER",
  "dawVersion": "7.x",
  "version": 2,
  "description": "Sessão completa com guia e click",
  "format": "WAV",
  "sampleRate": 48000,
  "bitDepth": 24,
  "duration": 248,
  "packagePath": "sessions/song_001/session_001/package/session.zip",
  "packageSize": 1073741824,
  "files": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 6. Armazenamento

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

O ZIP é o pacote principal de download. Os arquivos individuais existem para consulta e
download opcional.

---

## 7. Modo demonstração

Enquanto `js/firebase/config.js` mantiver os valores de exemplo, a aplicação funciona em
**modo demonstração**: o catálogo é exibido com uma biblioteca local de exemplo, o login fica
indisponível e o download é bloqueado com uma mensagem explícita.

Isso permite avaliar toda a interface antes de criar o projeto no Firebase.

---

## 8. Configuração do Firebase

1. Crie um projeto no [Console do Firebase](https://console.firebase.google.com).
2. Ative **Authentication** (e-mail/senha), **Cloud Firestore** e **Storage**.
3. Registre um app da Web e copie as chaves para `js/firebase/config.js`.
4. Aplique as Security Rules descritas em `docs/security.md`.
5. Conceda o acesso administrativo ao usuário:

   ```bash
   # Custom claim usada pelas Security Rules
   admin: true
   ```

6. Publique o site em **GitHub Pages**.

---

## 9. Segurança

A proteção dos dados é aplicada nas **Security Rules** do Firestore e do Storage, não apenas
na interface administrativa. A existência de uma página administrativa não autoriza o usuário.

```text
Aplicação pública    READ songs/sessions   → permitido
                     WRITE / DELETE        → negado

Administrador        READ / CREATE / UPDATE / DELETE / UPLOAD → permitido
```

As chaves do Firebase Web SDK são públicas por natureza. A restrição do domínio nas chaves de
API e as regras de segurança são o que protege a biblioteca.

---

## 10. Privacidade dos Arquivos

```text
GitHub
   └── Código

Firebase
   ├── Banco
   └── Arquivos de áudio
```

Os arquivos de áudio e os pacotes de sessão **não são armazenados no repositório Git**.

---

## 11. Roadmap

### MVP

- [x] Catálogo: lista, busca, filtros e página da música
- [x] Modelos de dados e camada de acesso
- [ ] Firebase: Authentication, Firestore e Storage
- [ ] Administração: cadastro de músicas e sessões
- [ ] Upload de pacote ZIP
- [ ] Download do pacote completo
- [ ] Security Rules

### Futuro

Favoritos, histórico de downloads, capa da música, busca avançada, filtros combinados,
estatísticas da biblioteca, validação de arquivos, visualização da estrutura do pacote e backup.

---

## 12. Princípio Arquitetural

> **KyriosStems armazena e organiza sessões prontas; não modifica o conteúdo musical.**

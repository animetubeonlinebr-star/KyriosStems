/**
 * KyriosStems - js/core/constants.js
 * Vocabulário do domínio: DAWs, tons, compassos, categorias e caminhos.
 */

export const APP = {
  name: 'KyriosStems',
  fullName: 'KYRIOS STEMS',
  tagline: 'Repositório de Stems',
  version: '1.0.0',
};

/** Coleções do Firestore. */
export const COLLECTIONS = {
  songs: 'songs',
  sessions: 'sessions',
};

/**
 * Prefixo raiz no Firebase Storage.
 * sessions/{songId}/{sessionId}/package/session.zip
 */
export const STORAGE_ROOT = 'sessions';

/** Subpastas dentro de uma sessão no Storage. */
export const STORAGE_FOLDERS = {
  package: 'package',
  project: 'project',
  audio: 'audio',
  aux: 'aux',
};

/** Nome canônico do pacote principal. */
export const PACKAGE_FILE_NAME = 'session.zip';

export const DAWS = [
  'REAPER',
  'Ableton Live',
  'Cubase',
  'Studio One',
  'Logic Pro',
  'Pro Tools',
  'FL Studio',
  'Bitwig Studio',
  'Ardour',
  'Outra',
];

/** Extensão de projeto associada a cada DAW (usada apenas como sugestão). */
export const DAW_PROJECT_EXTENSIONS = {
  REAPER: '.rpp',
  'Ableton Live': '.als',
  Cubase: '.cpr',
  'Studio One': '.song',
  'Logic Pro': '.logicx',
  'Pro Tools': '.ptx',
  'FL Studio': '.flp',
  'Bitwig Studio': '.bwproject',
  Ardour: '.ardour',
  Outra: '',
};

export const MUSICAL_KEYS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb',
  'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Am', 'A#m', 'Bbm', 'Bm', 'Cm', 'C#m', 'Dm', 'D#m', 'Ebm',
  'Em', 'Fm', 'F#m', 'Gm', 'G#m',
];

export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8'];

export const CATEGORIES = [
  'Louvor',
  'Adoração',
  'Hino',
  'Gospel',
  'Instrumental',
  'Natal',
  'Infantil',
  'Outra',
];

export const AUDIO_FORMATS = ['WAV', 'AIFF', 'FLAC', 'MP3', 'Outro'];

export const SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000];

export const BIT_DEPTHS = [16, 24, 32];

/**
 * Extensões aceitas no upload.
 * A aplicação não processa áudio: apenas classifica e armazena.
 */
export const ACCEPTED_EXTENSIONS = [
  '.zip',
  '.rar',
  '.7z',
  '.wav',
  '.aif',
  '.aiff',
  '.flac',
  '.mp3',
  '.rpp',
  '.als',
  '.cpr',
  '.song',
  '.ptx',
  '.flp',
  '.bwproject',
  '.ardour',
  '.logicx',
  '.txt',
  '.pdf',
  '.md',
];

/** Mapa de extensão -> categoria de arquivo na sessão. */
export const EXTENSION_CATEGORY = {
  '.zip': 'package',
  '.rar': 'package',
  '.7z': 'package',
  '.rpp': 'project',
  '.als': 'project',
  '.cpr': 'project',
  '.song': 'project',
  '.ptx': 'project',
  '.flp': 'project',
  '.bwproject': 'project',
  '.ardour': 'project',
  '.logicx': 'project',
  '.wav': 'audio',
  '.aif': 'audio',
  '.aiff': 'audio',
  '.flac': 'audio',
  '.mp3': 'audio',
};

/** Rótulos das categorias de arquivo. */
export const FILE_CATEGORY_LABELS = {
  package: 'Pacote',
  project: 'Projeto da DAW',
  audio: 'Áudio',
  aux: 'Auxiliares',
};

/** Ordem de exibição das categorias de arquivo. */
export const FILE_CATEGORY_ORDER = ['package', 'project', 'audio', 'aux'];

/** Rotas internas. */
export const ROUTES = {
  catalog: 'index.html',
  song: 'song.html',
  login: 'login.html',
  admin: 'admin.html',
};

/** Chaves de query string. */
export const QUERY = {
  songId: 'id',
  sessionId: 'session',
};

/** Limites práticos de upload (o Firebase Storage tem limite configurável). */
export const UPLOAD_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024 * 1024,
  maxFiles: 200,
  /** Tamanho a partir do qual o download exige confirmação do usuário. */
  largePackageBytes: 512 * 1024 * 1024,
};

/**
 * Limites de tempo para operações de rede.
 *
 * O Firestore, em dispositivo offline ou projeto mal configurado, não rejeita a
 * leitura: ele repete com backoff. Sem estes limites a interface fica
 * carregando indefinidamente.
 */
export const NETWORK = {
  /** Carregamento dos módulos do SDK pelo CDN. */
  sdkTimeoutMs: 12000,
  /** Consulta ao Firestore. */
  readTimeoutMs: 10000,
  /** Autenticação e verificação de sessão. */
  authTimeoutMs: 8000,
};

/**
 * Google Drive, usado para os arquivos das sessões.
 *
 * Por que o Drive e não o Firebase Storage: os pacotes de sessão têm gigabytes,
 * e o plano gratuito do Storage não comporta isso. O Drive da conta dedicada
 * tem cota própria e é acessível direto do navegador pelo Google Identity
 * Services, sem servidor no meio.
 */
export const GOOGLE = {
  /**
   * Escopo mínimo capaz de criar e gerenciar os arquivos da biblioteca.
   *
   * `drive.file` dá acesso apenas aos arquivos criados por esta aplicação: ela
   * não lê nem altera o resto do Drive do usuário. Escopos amplos exigiriam
   * verificação do app pelo Google e dariam acesso a tudo, sem necessidade.
   */
  driveScope: 'https://www.googleapis.com/auth/drive.file',
  /** Endpoint de upload e de metadados. */
  apiBase: 'https://www.googleapis.com/drive/v3',
  uploadBase: 'https://www.googleapis.com/upload/drive/v3',
  /** MIME de pasta no Drive. */
  folderMimeType: 'application/vnd.google-apps.folder',
  /** Margem antes da expiração para renovar o token em vez de falhar no meio. */
  tokenSafetyMarginMs: 60 * 1000,
  /** Usado quando o Google não informa `expires_in`. */
  defaultTokenTtlSeconds: 3600,
};

/**
 * Cota de armazenamento, usada apenas como referência visual no painel.
 *
 * É o espaço gratuito da conta Google que hospeda os arquivos. O valor real
 * depende do plano da conta.
 */
export const STORAGE_QUOTA_BYTES = 15 * 1024 * 1024 * 1024;
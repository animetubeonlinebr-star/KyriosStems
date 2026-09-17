/**
 * KyriosStems - js/data/demo-data.js
 * Biblioteca de demonstração.
 *
 * Usada quando o Firebase ainda não está configurado, para que a interface do
 * catálogo possa ser avaliada sem backend. Não representa sessões reais: os
 * pacotes não existem, portanto o download fica indisponível.
 */

import { EXTENSION_CATEGORY } from '../core/constants.js';

/** Prefixo de pasta exibido para cada categoria de arquivo. */
const FOLDER_PREFIX = {
  package: '',
  project: 'Project/',
  audio: 'Audio/',
  aux: '',
};

/**
 * Sessões de demonstração.
 *
 * `createdAt` corresponde à publicação da versão; `updatedAt` à última
 * revisão. É o que permite identificar a versão atual e ordenar o histórico.
 *
 * Arquivos individuais descrevem a estrutura preservada dentro do pacote. Os
 * caminhos de Storage são fictícios: em modo demonstração o download falha de
 * propósito, pois nenhum arquivo real existe.
 */
function sessionEntries(songId, music, sessions) {
  const created = music.createdAt || '2026-09-12T10:00:00.000Z';

  return sessions.map((item, index) => {
    const id = `${songId}_session_${String(index + 1).padStart(2, '0')}`;

    return {
      id,
      songId,
      daw: item.daw,
      dawVersion: item.dawVersion || '',
      version: item.version,
      description: item.description || '',
      format: item.format || 'WAV',
      sampleRate: item.sampleRate || 48000,
      bitDepth: item.bitDepth || 24,
      duration: item.duration ?? music.duration ?? null,
      packagePath: '',
      packageSize: null,
      files: (item.files || []).map((file) => {
        const category = categorizeByName(file);
        return {
          name: file,
          path: `${FOLDER_PREFIX[category] || ''}${file}`,
          storagePath: `sessions/${songId}/${id}/${category}/${file}`,
          size: 0,
          category,
          contentType: 'application/octet-stream',
        };
      }),
      createdAt: item.createdAt || created,
      updatedAt: item.updatedAt || item.createdAt || created,
    };
  });
}

/** Categoria de arquivo derivada da extensão, sem depender do SDK. */
function categorizeByName(fileName) {
  const index = fileName.lastIndexOf('.');
  const ext = index === -1 ? '' : fileName.slice(index).toLowerCase();
  return EXTENSION_CATEGORY[ext] || 'aux';
}

/**
 * Arquivos de uma sessão completa, na estrutura preservada dentro do pacote.
 * A pasta de cada arquivo é derivada da extensão.
 */
function sessionFiles(projectFileName) {
  return [
    projectFileName,
    '01 Drums.wav',
    '02 Bass.wav',
    '03 Guitar.wav',
    '04 Piano.wav',
    '05 Keys.wav',
    '06 Vocal.wav',
    '07 BGV.wav',
    '08 Guide.wav',
    '09 Click.wav',
    'README.txt',
  ];
}

/**
 * @param {string} id
 * @param {string} title
 * @param {string} artist
 * @param {object} music
 * @param {Array<{daw: string, version: number, description: string, createdAt?: string, updatedAt?: string}>} sessions
 */
function song(id, title, artist, music, sessions) {
  const createdAt = music.createdAt || '2026-09-12T10:00:00.000Z';
  return {
    song: {
      id,
      title,
      artist,
      album: music.album || '',
      key: music.key || '',
      bpm: music.bpm ?? null,
      timeSignature: music.timeSignature || '4/4',
      duration: music.duration ?? null,
      category: music.category || '',
      tags: music.tags || [],
      coverUrl: '',
      description: music.description || '',
      createdAt,
      updatedAt: music.updatedAt || createdAt,
    },
    sessions: sessionEntries(id, music, sessions),
  };
}

const DEMO = [
  song(
    'song_001',
    'Vim Para Adorar-te',
    'Adoração e Adoradores',
    {
      album: 'Adoração e Adoradores',
      key: 'E',
      bpm: 72,
      timeSignature: '4/4',
      duration: 248,
      category: 'Louvor',
      tags: ['adoração', 'lento'],
      description:
        'Sessão completa com guia, click e stems separados por instrumento. Estrutura preservada para abertura direta na DAW.',
      updatedAt: '2026-09-17T09:20:00.000Z',
    },
    [
      {
        daw: 'REAPER',
        dawVersion: '7.x',
        version: 2,
        description: 'Sessão revisada com click novo.',
        files: sessionFiles('Vim Para Adorar-te.rpp'),
        createdAt: '2026-09-17T09:20:00.000Z',
        updatedAt: '2026-09-17T09:20:00.000Z',
      },
      {
        daw: 'REAPER',
        dawVersion: '7.x',
        version: 1,
        description: 'Sessão completa com guia e click.',
        createdAt: '2026-09-12T10:00:00.000Z',
        updatedAt: '2026-09-12T10:00:00.000Z',
      },
      {
        daw: 'Ableton Live',
        dawVersion: '12',
        version: 1,
        description: 'Conversão direta da sessão v1.',
        createdAt: '2026-09-13T15:40:00.000Z',
        updatedAt: '2026-09-13T15:40:00.000Z',
      },
    ],
  ),
  song(
    'song_002',
    'Oceans',
    'Hillsong UNITED',
    {
      album: 'Zion',
      key: 'D',
      bpm: 76,
      timeSignature: '4/4',
      duration: 402,
      category: 'Adoração',
      tags: ['adoração', 'épico'],
      description: 'Multitrack completo com camadas de guitarra ambiente.',
      createdAt: '2026-09-10T14:00:00.000Z',
    },
    [
      {
        daw: 'REAPER',
        dawVersion: '7.x',
        version: 2,
        description: 'Ajuste de ganho nos pads.',
        createdAt: '2026-09-14T16:10:00.000Z',
        updatedAt: '2026-09-14T16:10:00.000Z',
      },
      {
        daw: 'REAPER',
        dawVersion: '7.x',
        version: 1,
        description: 'Versão inicial.',
        createdAt: '2026-09-10T14:00:00.000Z',
        updatedAt: '2026-09-10T14:00:00.000Z',
      },
      {
        daw: 'Cubase',
        dawVersion: '13',
        version: 1,
        description: 'Sessão para Cubase com grupos já configurados.',
        createdAt: '2026-09-11T09:30:00.000Z',
        updatedAt: '2026-09-11T09:30:00.000Z',
      },
    ],
  ),
  song(
    'song_003',
    'Grande é o Senhor',
    'Adhemar de Campos',
    {
      album: 'Grande é o Senhor',
      key: 'G',
      bpm: 128,
      timeSignature: '4/4',
      duration: 216,
      category: 'Louvor',
      tags: ['louvor', 'rápido', 'congregacional'],
      description: 'Arranjo congregacional com BGV em duas vozes.',
      createdAt: '2026-09-08T09:00:00.000Z',
    },
    [
      {
        daw: 'Studio One',
        dawVersion: '6',
        version: 1,
        description: 'Sessão com click e guia vocal.',
      },
    ],
  ),
  song(
    'song_004',
    'Nada Além do Sangue',
    'Fernandinho',
    {
      album: 'Acústico',
      key: 'Bb',
      bpm: 68,
      timeSignature: '6/8',
      duration: 334,
      category: 'Adoração',
      tags: ['adoração', 'lento', 'piano'],
      description: 'Sessão centrada em piano e orquestra.',
      createdAt: '2026-09-05T18:30:00.000Z',
    },
    [
      {
        daw: 'REAPER',
        dawVersion: '7.x',
        version: 1,
        description: 'Piano, cordas e guia.',
        files: sessionFiles('Nada Alem do Sangue.rpp'),
      },
      {
        daw: 'Logic Pro',
        dawVersion: '11',
        version: 1,
        description: 'Sessão adaptada para Logic.',
        files: sessionFiles('Nada Alem do Sangue.logicx'),
      },
    ],
  ),
  song(
    'song_005',
    'Bondade de Deus',
    'Isaías Saad',
    {
      album: 'Bondade de Deus',
      key: 'A',
      bpm: 70,
      timeSignature: '4/4',
      duration: 298,
      category: 'Louvor',
      tags: ['louvor', 'declaração'],
      description: 'Sessão com synths e bateria eletrônica.',
      createdAt: '2026-09-02T11:15:00.000Z',
    },
    [
      {
        daw: 'Ableton Live',
        dawVersion: '12',
        version: 1,
        description: 'Sessão com racks de synth.',
      },
    ],
  ),
  song(
    'song_006',
    'Santo Espírito',
    'Laura Souguellis',
    {
      album: 'Ao Vivo',
      key: 'F',
      bpm: 64,
      timeSignature: '4/4',
      duration: 512,
      category: 'Adoração',
      tags: ['espontâneo', 'lento'],
      description: 'Momento espontâneo com pad contínuo.',
      createdAt: '2026-08-28T20:45:00.000Z',
    },
    [
      {
        daw: 'REAPER',
        dawVersion: '6.x',
        version: 3,
        description: 'Terceira revisão da sessão.',
        files: sessionFiles('Santo Espirito.rpp'),
      },
    ],
  ),
];

/** Retorna uma cópia profunda da biblioteca de demonstração. */
export function demoLibrary() {
  return JSON.parse(JSON.stringify(DEMO));
}

/** Sessões de demonstração em lista plana. */
export function demoSessions() {
  return demoLibrary().flatMap((entry) => entry.sessions);
}
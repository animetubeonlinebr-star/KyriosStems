/**
 * KyriosStems - backend/src/lib/files.js
 * Classificação e nomes de arquivo.
 *
 * Reproduz o vocabulário de js/core/constants.js do frontend. Fica duplicado de
 * propósito: o servidor não pode depender de um módulo que roda no navegador,
 * e a classificação é regra de domínio, não detalhe de apresentação.
 */

export const PACKAGE_FILE_NAME = 'session.zip';

/** Categorias aceitas, as mesmas do CHECK em session_files. */
export const CATEGORIES = ['package', 'project', 'audio', 'aux'];

const EXTENSION_CATEGORY = {
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

/** Extensão em minúsculas, incluindo o ponto. */
export function fileExtension(name) {
  const clean = String(name || '');
  const index = clean.lastIndexOf('.');
  return index <= 0 ? '' : clean.slice(index).toLowerCase();
}

/** Categoria derivada da extensão. */
export function categorize(name) {
  return EXTENSION_CATEGORY[fileExtension(name)] || 'aux';
}

/**
 * Remove do nome o que não pode virar nome de arquivo.
 *
 * O Drive aceita quase tudo, mas barras e caracteres de controle quebrariam a
 * exibição e a montagem do caminho. O nome é do usuário; o caminho é nosso.
 */
export function sanitizeFileName(name) {
  const base = String(name || 'arquivo')
    .replace(/[\\/]/g, '-')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^\.+/, '')
    .trim();

  return base.slice(0, 255) || 'arquivo';
}

/**
 * Nome amigável do pacote no download.
 * "Vim Para Adorar-te - REAPER - v2.zip"
 */
export function packageFileName(song, session) {
  const parts = [
    song?.title || 'Sessão',
    session?.daw || '',
    session?.version ? `v${session.version}` : '',
  ].filter(Boolean);

  return `${sanitizeFileName(parts.join(' - '))}.zip`;
}

/** Nome de pasta seguro, derivado de um id. */
export function folderName(prefix, id) {
  return `${prefix}_${sanitizeFileName(String(id))}`;
}

/**
 * Reduz um nome ao que é seguro colocar em um cabeçalho HTTP.
 *
 * Quebras de linha em um valor de cabeçalho permitem injetar cabeçalhos
 * arbitrários na resposta (response splitting), e aspas quebrariam o
 * Content-Disposition. O nome vem da consulta, portanto é dado do usuário.
 */
export function safeHeaderFileName(name) {
  return String(name || '')
    .replace(/[\r\n\u0000-\u001f\u007f]/g, '')
    .replace(/["\\]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .trim()
    .slice(0, 200);
}
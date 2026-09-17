/**
 * KyriosStems - js/core/format.js
 * Formatação de valores e utilidades de apresentação.
 */

/** Escapa texto para interpolação segura em HTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** Formata bytes em unidade legível. */
export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** exponent;
  const decimals = exponent === 0 ? 0 : size >= 100 ? 0 : 1;

  return `${size.toFixed(decimals).replace('.', ',')} ${units[exponent]}`;
}

/** Formata duração em segundos para m:ss (ou h:mm:ss). */
export function formatDuration(seconds) {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return '—';

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Converte Timestamp do Firestore, Date ou string em Date. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formata data curta no padrão brasileiro. */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Formata data e hora no padrão brasileiro. */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formata BPM. */
export function formatBpm(bpm) {
  const value = Number(bpm);
  return Number.isFinite(value) && value > 0 ? `${value} BPM` : '—';
}

/** Formata a especificação de áudio da sessão. */
export function formatAudioSpec(session) {
  const parts = [
    session.format || null,
    session.bitDepth ? `${session.bitDepth} bit` : null,
    session.sampleRate ? `${session.sampleRate} Hz` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' • ') : '—';
}

/** Normaliza texto para busca/comparação (sem acentos e minúsculo). */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Gera identificador legível e único. */
export function createId(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

/** Gera um slug a partir de texto livre. */
export function slugify(value) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'sem-titulo';
}

/** Retorna a extensão em minúsculas, incluindo o ponto. */
export function fileExtension(fileName) {
  const name = String(fileName ?? '');
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
}

/** Remove caminhos de diretório e caracteres perigosos do nome do arquivo. */
export function sanitizeFileName(fileName) {
  const base = String(fileName ?? 'arquivo').split(/[\\/]/).pop() || 'arquivo';
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim() || 'arquivo';
}

/** Agrupa uma lista por chave. */
export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Ordena strings alfabeticamente respeitando acentos. */
export function compareText(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base' });
}

/** Remove duplicatas preservando a ordem. */
export function unique(items) {
  return Array.from(
    new Set(items.filter((item) => item !== null && item !== undefined && item !== '')),
  );
}

/** Limita a execução de uma função (debounce). */
export function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
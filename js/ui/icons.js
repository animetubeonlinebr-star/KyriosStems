/**
 * KyriosStems - js/ui/icons.js
 * Ícones SVG inline (stroke), sem dependência externa.
 */

const PATHS = {
  wave: '<path d="M2 12h2m3 0h1M10 12h1m3 0h1m3 0h2M5 7v10m6-14v18m6-12v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/>',
  upload: '<path d="M12 21V9m0 0l-4 4m4-4l4 4M4 5h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  arrowLeft: '<path d="M15 18l-6-6 6-6"/>',
  logout: '<path d="M15 4h4v16h-4M11 8l-4 4 4 4M3 12h8"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  dashboard: '<rect x="3" y="3" width="8" height="10"/><rect x="13" y="3" width="8" height="6"/><rect x="13" y="11" width="8" height="10"/><rect x="3" y="15" width="8" height="6"/>',
  /* Biblioteca: estante com faixas, remetendo ao catálogo de músicas. */
  library: '<path d="M4 4h6v16H4zM14 4h6v16h-6z"/><path d="M4 9h6M14 9h6"/>',
  disk: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  refresh: '<path d="M20 11a8 8 0 10-2 6"/><path d="M20 4v7h-7"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  alert: '<path d="M12 3l9 16H3z"/><path d="M12 9v5m0 3v.5"/>',
};

/**
 * Cria um elemento SVG.
 * @param {keyof typeof PATHS} name
 * @param {{class?: string, size?: number}} [options]
 */
export function icon(name, { class: className = '', size = 24 } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = PATHS[name] || PATHS.file;
  return svg;
}

export const ICON_NAMES = Object.keys(PATHS);
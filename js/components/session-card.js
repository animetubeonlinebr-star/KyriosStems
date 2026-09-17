/**
 * KyriosStems - js/components/session-card.js
 * Cartão de sessão DAW com o download do pacote como ação principal.
 */

import { el } from '../core/dom.js';
import { formatAudioSpec, formatBytes, formatDate, formatDuration } from '../core/format.js';
import { versionLabel } from '../models/daw-session.js';
import { icon } from '../ui/icons.js';

/**
 * @param {import('../models/daw-session.js').DawSession} session
 * @param {object} [options]
 * @param {boolean} [options.isCurrent]
 * @param {(session: object) => void} [options.onDownload]
 * @param {() => void} [options.onToggleFiles]
 */
export function sessionCard(session, { isCurrent = false, onDownload, onToggleFiles } = {}) {
  const hasPackage = Boolean(session.packagePath);

  const specs = el('div', { class: 'spec-list' }, [
    spec('Formato', session.format || '—'),
    spec('Bit depth', session.bitDepth ? `${session.bitDepth} bit` : '—'),
    spec('Sample rate', session.sampleRate ? `${session.sampleRate} Hz` : '—'),
    spec('Duração', formatDuration(session.duration)),
    spec('DAW', session.dawVersion || '—'),
    spec('Versão', versionLabel(session)),
  ]);

  const downloadButton = el('button', {
    type: 'button',
    class: 'btn btn--primary',
    disabled: !hasPackage,
    title: hasPackage ? 'Baixar o pacote completo' : 'Pacote não enviado',
    onClick: () => onDownload?.(session),
  }, [
    icon('download', { size: 14 }),
    'Baixar sessão completa',
  ]);

  const actions = el('div', { class: 'session-card__actions' }, [
    downloadButton,
    session.files?.length
      ? el('button', {
          type: 'button',
          class: 'btn btn--ghost btn--sm',
          onClick: () => onToggleFiles?.(session),
        }, [icon('folder', { size: 14 }), `Arquivos (${session.files.length})`])
      : null,
    el(
      'span',
      { class: 'session-card__size mono' },
      hasPackage && session.packageSize ? formatBytes(session.packageSize) : '',
    ),
  ]);

  return el('article', {
    class: `session-card${isCurrent ? ' is-current' : ''}`,
    id: `session-${session.id}`,
  }, [
    el('div', { class: 'session-card__head' }, [
      el('div', { class: 'session-card__daw' }, [
        icon('wave', { size: 18, class: 'text-faint' }),
        el('span', { class: 'session-card__daw-name', text: session.daw || 'DAW não informada' }),
        el('span', { class: 'session-card__version mono', text: versionLabel(session) }),
      ]),
      el('div', { class: 'cluster' }, [
        isCurrent ? el('span', { class: 'badge badge--accent', text: 'Atual' }) : null,
        el('span', { class: 'badge', text: formatDate(session.updatedAt || session.createdAt) }),
      ]),
    ]),
    session.description
      ? el('p', { class: 'session-card__description', text: session.description })
      : null,
    specs,
    el('p', { class: 'text-faint mono', style: 'font-size:0.6875rem' }, [
      formatAudioSpec(session),
    ]),
    actions,
  ]);
}

function spec(label, value) {
  return el('div', { class: 'spec' }, [
    el('span', { class: 'spec__label', text: label }),
    el('span', { class: 'spec__value', text: value }),
  ]);
}
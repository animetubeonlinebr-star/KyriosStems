/**
 * KyriosStems - js/components/song-card.js
 * Cartão de música na grade do catálogo.
 */

import { el } from '../core/dom.js';
import { formatBpm } from '../core/format.js';
import { ROUTES, QUERY } from '../core/constants.js';
import { icon } from '../ui/icons.js';

export function songUrl(songId) {
  return `${ROUTES.song}?${QUERY.songId}=${encodeURIComponent(songId)}`;
}

/**
 * @param {import('../models/song.js').Song} song
 * @param {{sessions: import('../models/daw-session.js').DawSession[]}} [context]
 */
export function songCard(song, { sessions = [] } = {}) {
  const daws = [...new Set(sessions.map((session) => session.daw).filter(Boolean))].sort();
  const sessionCount = sessions.length;
  const url = songUrl(song.id);

  const specs = el('div', { class: 'song-card__spec' }, [
    song.key ? el('span', { class: 'song-card__spec-key mono', text: song.key }) : null,
    song.key && song.bpm ? el('span', { class: 'song-card__spec-divider', text: '•' }) : null,
    song.bpm ? el('span', { class: 'mono', text: `${song.bpm} BPM` }) : null,
    song.timeSignature
      ? el('span', { class: 'song-card__spec-divider', text: '•' })
      : null,
    song.timeSignature ? el('span', { class: 'mono', text: song.timeSignature }) : null,
  ]);

  const dawBadges = daws.length
    ? el(
        'div',
        { class: 'song-card__daws' },
        daws.map((daw) => el('span', { class: 'badge badge--signal', text: daw })),
      )
    : el('div', { class: 'song-card__daws' }, [
        el('span', { class: 'badge badge--muted', text: 'Sem sessões' }),
      ]);

  return el('article', { class: 'song-card' }, [
    el('div', { class: 'song-card__head' }, [
      el('div', {}, [
        el('h3', { class: 'song-card__title' }, [el('a', { href: url, text: song.title })]),
        el('p', { class: 'song-card__artist', text: song.artist || 'Intérprete não informado' }),
      ]),
      el('span', { class: 'song-card__count mono', title: 'Sessões disponíveis' }, [
        String(sessionCount).padStart(2, '0'),
      ]),
    ]),
    specs,
    song.tags?.length
      ? el(
          'ul',
          { class: 'chip-list' },
          song.tags.slice(0, 4).map((tag) => el('li', { class: 'badge badge--muted', text: tag })),
        )
      : null,
    dawBadges,
    el('div', { class: 'song-card__footer' }, [
      el('span', { class: 'song-card__count mono', text: formatBpm(song.bpm) }),
      el('span', { class: 'song-card__cta' }, [
        'Ver sessão',
        icon('download', { size: 12 }),
      ]),
    ]),
  ]);
}
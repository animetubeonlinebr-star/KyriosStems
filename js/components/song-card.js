/**
 * KyriosStems - js/components/song-card.js
 * Cartão de música na grade do catálogo.
 *
 * Segue a referência visual: título, intérprete, linha de dados
 * (BPM, gênero, tom) e o botão ABRIR.
 */

import { el } from '../core/dom.js';
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
  const url = songUrl(song.id);
  const sessionCount = sessions.length;

  // Linha de dados: BPM, gênero e tom, na ordem da referência.
  const facts = [];
  if (song.bpm) facts.push(`${song.bpm} BPM`);
  if (song.category) facts.push(song.category);
  if (song.key) facts.push(`Tom ${song.key}`);

  return el('article', { class: 'song-card' }, [
    el('div', { class: 'song-card__head' }, [
      el('div', { class: 'song-card__ident' }, [
        el('h3', { class: 'song-card__title' }, [el('a', { href: url, text: song.title })]),
        el('p', { class: 'song-card__artist', text: song.artist || 'Intérprete não informado' }),
      ]),
      sessionCount
        ? el('span', { class: 'badge badge--muted mono', text: `${sessionCount} sessão(ões)` })
        : el('span', { class: 'badge badge--muted', text: 'Sem sessões' }),
    ]),

    facts.length
      ? el(
          'p',
          { class: 'song-card__facts' },
          facts.flatMap((fact, index) =>
            index === 0 ? [fact] : [el('span', { class: 'song-card__dot', text: '•' }), fact],
          ),
        )
      : null,

    el('div', { class: 'song-card__footer' }, [
      el(
        'div',
        { class: 'song-card__daws' },
        sessions.length
          ? [...new Set(sessions.map((session) => session.daw).filter(Boolean))]
              .sort()
              .map((daw) => el('span', { class: 'badge badge--signal', text: daw }))
          : [],
      ),
      el('a', { class: 'btn btn--secondary btn--sm', href: url }, [
        'Abrir',
        icon('chevron', { size: 14 }),
      ]),
    ]),
  ]);
}
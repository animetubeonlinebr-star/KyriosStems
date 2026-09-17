/**
 * KyriosStems - js/components/app-header.js
 * Cabeçalho público das páginas de catálogo e música.
 */

import { el } from '../core/dom.js';
import { APP, ROUTES } from '../core/constants.js';
import { icon } from '../ui/icons.js';

/**
 * @param {{active?: 'catalog'|'song'|'admin', adminHref?: string}} [options]
 */
export function renderHeader({ active = 'catalog', adminHref = null } = {}) {
  const header = el('header', { class: 'site-header' }, [
    el('div', { class: 'container site-header__inner' }, [
      el('a', { class: 'brand', href: ROUTES.catalog, 'aria-label': `${APP.fullName} — início` }, [
        el('span', { class: 'brand__mark' }, [icon('wave', { size: 20 })]),
        el('span', { class: 'brand__text' }, [
          el('span', { class: 'brand__name', text: APP.name }),
          el('span', { class: 'brand__tagline', text: 'Multitrack Library' }),
        ]),
      ]),
      el('nav', { class: 'site-nav', 'aria-label': 'Navegação principal' }, [
        el('a', {
          class: `site-nav__link${active === 'catalog' ? ' is-active' : ''}`,
          href: ROUTES.catalog,
          text: 'Catálogo',
        }),
        el('a', {
          class: `site-nav__link${active === 'admin' ? ' is-active' : ''}`,
          href: adminHref || ROUTES.login,
          text: adminHref ? 'Painel' : 'Entrar',
        }),
      ]),
    ]),
  ]);

  return header;
}

/** Rodapé padrão com o princípio arquitetural do projeto. */
export function renderFooter() {
  return el('footer', { class: 'site-footer' }, [
    el('div', { class: 'container site-footer__inner' }, [
      el('span', { text: `${APP.fullName} — ${APP.tagline}` }),
      el('span', {
        class: 'mono',
        text: 'Armazena e organiza sessões prontas; não modifica o conteúdo musical.',
      }),
    ]),
  ]);
}

/** Injeta cabeçalho e rodapé em uma página. */
export function mountChrome({ active, adminHref } = {}) {
  const headerMount = document.querySelector('[data-header]');
  const footerMount = document.querySelector('[data-footer]');
  if (headerMount) headerMount.replaceWith(renderHeader({ active, adminHref }));
  if (footerMount) footerMount.replaceWith(renderFooter());
}
/**
 * KyriosStems - js/components/app-header.js
 * Navegação pública: barra superior e, no celular, barra inferior.
 *
 * A barra inferior fica ao alcance do polegar no celular. Ela usa a mesma lista
 * de itens da barra superior, apenas apresentada de outra forma: uma única
 * fonte de verdade evita que as duas divirjam.
 */

import { el } from '../core/dom.js';
import { APP, ROUTES } from '../core/constants.js';
import { icon } from '../ui/icons.js';

/** Itens de navegação, na ordem em que aparecem. */
function navigationItems(adminHref) {
  return [
    { key: 'catalog', label: 'Catálogo', href: ROUTES.catalog, icon: 'library' },
    {
      key: 'admin',
      label: adminHref ? 'Painel' : 'Entrar',
      href: adminHref || ROUTES.login,
      icon: 'dashboard',
    },
  ];
}

/** A página da música pertence ao catálogo na navegação. */
function isActive(item, active) {
  if (item.key === 'catalog') return active === 'catalog' || active === 'song';
  return item.key === active;
}

/**
 * @param {{active?: 'catalog'|'song'|'admin', adminHref?: string|null}} [options]
 */
export function renderHeader({ active = 'catalog', adminHref = null } = {}) {
  return el('header', { class: 'site-header' }, [
    el('div', { class: 'container site-header__inner' }, [
      el('a', { class: 'brand', href: ROUTES.catalog, 'aria-label': `${APP.fullName} — início` }, [
        el('span', { class: 'brand__mark' }, [icon('wave', { size: 18 })]),
        el('span', { class: 'brand__text' }, [
          el('span', { class: 'brand__name', text: APP.name }),
          el('span', { class: 'brand__tagline', text: APP.tagline }),
        ]),
      ]),
      el(
        'nav',
        { class: 'site-nav', 'aria-label': 'Navegação principal' },
        navigationItems(adminHref).map((item) => {
          const current = isActive(item, active);
          return el('a', {
            class: `site-nav__link${current ? ' is-active' : ''}`,
            href: item.href,
            text: item.label,
            'aria-current': current ? 'page' : null,
          });
        }),
      ),
    ]),
  ]);
}

/** Barra inferior fixa, exibida apenas no celular. */
export function renderBottomNav({ active = 'catalog', adminHref = null } = {}) {
  return el(
    'nav',
    { class: 'bottom-nav', 'aria-label': 'Navegação inferior' },
    navigationItems(adminHref).map((item) => {
      const current = isActive(item, active);
      return el(
        'a',
        {
          class: `bottom-nav__item${current ? ' is-active' : ''}`,
          href: item.href,
          'aria-current': current ? 'page' : null,
        },
        [icon(item.icon, { size: 22 }), el('span', { text: item.label })],
      );
    }),
  );
}

/** Rodapé padrão com o princípio arquitetural do projeto. */
export function renderFooter() {
  return el('footer', { class: 'site-footer' }, [
    el('div', { class: 'container site-footer__inner' }, [
      el('span', { text: `${APP.fullName} — ${APP.tagline}` }),
      el('span', { text: 'Armazena e organiza sessões prontas; não modifica o conteúdo musical.' }),
    ]),
  ]);
}

/**
 * Injeta cabeçalho, rodapé e barra inferior.
 * @param {{active?: string, adminHref?: string|null}} [options]
 */
export function mountChrome({ active, adminHref } = {}) {
  const headerMount = document.querySelector('[data-header]');
  const footerMount = document.querySelector('[data-footer]');
  const bottomNavMount = document.querySelector('[data-bottom-nav]');

  if (headerMount) headerMount.replaceWith(renderHeader({ active, adminHref }));
  if (footerMount) footerMount.replaceWith(renderFooter());
  if (bottomNavMount) bottomNavMount.replaceWith(renderBottomNav({ active, adminHref }));
}
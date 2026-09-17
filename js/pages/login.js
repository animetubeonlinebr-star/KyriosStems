/**
 * KyriosStems - js/pages/login.js
 * Tela de entrada do administrador.
 */

import { $, clear, el, mount, ready, queryParams } from '../core/dom.js';
import { ROUTES } from '../core/constants.js';
import { isFirebaseConfigured } from '../firebase/app.js';
import { signIn, authErrorMessage, observeAuth, isAdmin } from '../firebase/auth.js';
import { icon } from '../ui/icons.js';

const MOTIVES = {
  'nao-configurado':
    'O Firebase ainda não está configurado. Preencha js/firebase/config.js antes de entrar.',
  'tempo-esgotado': 'A verificação da sessão demorou demais. Tente novamente.',
  'nao-autorizado':
    'Sua conta não possui acesso administrativo. A autorização vem da custom claim admin.',
  'sessao-encerrada': 'Sessão encerrada.',
};

ready(init);

async function init() {
  renderShell();

  if (!isFirebaseConfigured()) {
    showMotive('nao-configurado');
    return;
  }

  const session = await observeCurrentSession();
  if (session?.isAdmin) {
    window.location.replace(ROUTES.admin);
    return;
  }
  if (session?.user && !session.isAdmin) {
    showMotive('nao-autorizado');
  }

  showMotive(queryParams().get('motivo'));
}

function renderShell() {
  mount(document.body, el('div', { class: 'login-shell' }, [loginCard()]));
}

function loginCard() {
  const emailInput = el('input', {
    type: 'email',
    id: 'email',
    class: 'input',
    name: 'email',
    autocomplete: 'username',
    required: true,
    placeholder: 'seu@email.com',
  });

  const passwordInput = el('input', {
    type: 'password',
    id: 'password',
    class: 'input',
    name: 'password',
    autocomplete: 'current-password',
    required: true,
    placeholder: '••••••••',
  });

  const submitButton = el(
    'button',
    { type: 'submit', class: 'btn btn--primary btn--block' },
    ['Entrar no painel'],
  );

  const feedback = el('div', { 'data-feedback': true, role: 'alert' });
  const form = el('form', { class: 'login-card__form', novalidate: true }, [
    field('E-mail', emailInput),
    field('Senha', passwordInput),
    submitButton,
    feedback,
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(emailInput.value, passwordInput.value, submitButton, feedback);
  });

  return el('div', { class: 'login-card' }, [
    el('div', { class: 'login-card__brand' }, [
      el('span', { class: 'brand__mark' }, [icon('lock', { size: 20 })]),
      el('h1', { class: 'login-card__title', text: 'KyriosStems' }),
      el('p', { class: 'login-card__subtitle', text: 'Acesso administrativo' }),
    ]),
    form,
    el('div', { class: 'login-card__footer' }, [
      el('a', { href: ROUTES.catalog, text: '← Voltar ao catálogo' }),
    ]),
  ]);
}

function field(label, control) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: control.id, text: label }),
    control,
  ]);
}

async function submit(email, password, button, feedback) {
  clear(feedback);

  if (!email || !password) {
    mount(feedback, alertBox('Informe e-mail e senha.', 'error'));
    return;
  }

  button.disabled = true;
  button.textContent = 'Entrando...';

  try {
    const credential = await signIn(email, password);

    if (!(await isAdmin(credential.user))) {
      mount(
        feedback,
        alertBox(
          'Esta conta não possui acesso administrativo. Conceda a custom claim admin ao usuário.',
          'error',
        ),
      );
      return;
    }

    window.location.replace(ROUTES.admin);
  } catch (error) {
    mount(feedback, alertBox(authErrorMessage(error), 'error'));
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar no painel';
  }
}

function alertBox(message, type = 'error') {
  return el('div', { class: `alert alert--${type}` }, [icon('alert', { size: 16 }), message]);
}

function showMotive(motive) {
  const message = MOTIVES[motive];
  if (!message) return;

  const feedback = $('[data-feedback]');
  if (feedback) mount(feedback, alertBox(message, motive === 'sessao-encerrada' ? 'success' : 'info'));
}

/** Observa a sessão apenas durante o carregamento inicial. */
function observeCurrentSession() {
  return new Promise((resolve) => {
    let settled = false;

    observeAuth((session) => {
      if (settled) return;
      settled = true;
      resolve(session);
    }).catch(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });

    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 6000);
  });
}
/**
 * KyriosStems - js/pages/login.js
 * Tela de entrada do administrador.
 */

import { $, clear, el, mount, ready, queryParams } from '../core/dom.js';
import { ROUTES } from '../core/constants.js';
import { signIn, authErrorMessage, verifySession, isSignedIn } from '../api/auth.js';
import { icon } from '../ui/icons.js';

const MOTIVES = {
  'nao-autorizado': 'Entre com a conta administrativa para abrir o painel.',
  'sessao-encerrada': 'Sessão encerrada.',
};

ready(init);

async function init() {
  // O formulário vive no HTML, para que a página tenha conteúdo mesmo se o
  // módulo não carregar. Aqui só ligamos o comportamento.
  const form = $('[data-login-form]');

  if (form) {
    wireForm(form);
  } else {
    // Fallback: HTML sem o formulário pré-renderizado.
    renderShell();
    wireForm($('[data-login-form]'));
  }

  // Quem já tem sessão válida não precisa ver o formulário. A confirmação é
  // feita contra a API: guardar o token no navegador não prova que ele vale.
  if (isSignedIn()) {
    const session = await verifySession();
    if (session) {
      window.location.replace(ROUTES.admin);
      return;
    }
  }

  showMotive(queryParams().get('motivo'));
}

/** Liga o envio do formulário aos campos existentes. */
function wireForm(form) {
  if (!form) return;

  const emailInput = $('#email', form);
  const passwordInput = $('#password', form);
  const submitButton = $('[data-login-submit]', form);
  const feedback = $('[data-feedback]', form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(emailInput.value, passwordInput.value, submitButton, feedback);
  });
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
    { type: 'submit', class: 'btn btn--primary btn--block', 'data-login-submit': true },
    ['Entrar no painel'],
  );

  const feedback = el('div', { 'data-feedback': true, role: 'alert' });
  const form = el('form', { class: 'login-card__form', 'data-login-form': true, novalidate: true }, [
    field('E-mail', emailInput),
    field('Senha', passwordInput),
    submitButton,
    feedback,
  ]);

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
    await signIn(email, password);
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
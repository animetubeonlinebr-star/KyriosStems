/**
 * KyriosStems - js/pages/cadastro.js
 * Tela TEMPORÁRIA de cadastro de e-mail e senha.
 *
 * Existe apenas para criar a conta de administrador. Deve ser removida depois —
 * veja "Remover a tela temporária" no README. A biblioteca em si não depende
 * dela: continua sendo lida do Google Drive, sem login.
 */

import { $, clear, el, mount, ready } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { isFirebaseConfigured } from '../firebase/app.js';
import { register, validate, listRegistrations, describeAuthError } from '../firebase/registration.js';
import { formatDateTime } from '../core/format.js';

ready(init);

function init() {
  const form = $('[data-cadastro-form]');

  if (form) {
    wireForm(form);
  } else {
    // O HTML sempre traz o formulário; isto cobre uma página montada à mão.
    renderFallback();
    wireForm($('[data-cadastro-form]'));
  }

  if (!isFirebaseConfigured()) {
    showFeedback(
      'O Firebase ainda não foi configurado. Preencha js/firebase/config.js e publique as Security Rules.',
      'error',
    );
    return;
  }

  refreshList();
}

/** Liga o envio do formulário aos campos existentes. */
function wireForm(form) {
  if (!form) return;

  const email = $('#email', form);
  const password = $('#senha', form);
  const confirmation = $('#confirmacao', form);
  const button = $('[data-cadastro-submit]', form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit({ email, password, confirmation, button });
  });
}

async function submit({ email, password, confirmation, button }) {
  clearFeedback();

  const problem = validate({
    email: email.value,
    password: password.value,
    confirmation: confirmation.value,
  });

  if (problem) {
    showFeedback(problem, 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Cadastrando...';

  try {
    const created = await register({ email: email.value, password: password.value });

    email.value = '';
    password.value = '';
    confirmation.value = '';

    showFeedback(`${created.email} foi cadastrado. A senha está guardada com hash no Firebase.`, 'success');
    await refreshList();
  } catch (error) {
    showFeedback(describeAuthError(error), 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Cadastrar';
  }
}

/** Lista os e-mails já cadastrados, quando as rules permitirem a leitura. */
async function refreshList() {
  const mountPoint = $('[data-registrations]');
  if (!mountPoint) return;

  try {
    const items = await listRegistrations();
    clear(mountPoint);

    if (!items.length) {
      mount(mountPoint, el('p', { class: 'field__hint mt-4', text: 'Nenhum cadastro ainda.' }));
      return;
    }

    mount(mountPoint, el('ul', { class: 'cadastro-list' }, [
      el('li', { class: 'cadastro-list__item' }, [
        el('strong', { text: `${items.length} cadastro(s)` }),
      ]),
      ...items.map((item) => el('li', { class: 'cadastro-list__item' }, [
        el('span', { class: 'cadastro-list__email', text: item.email || '—' }),
        el('span', { class: 'cadastro-list__date', text: formatDateTime(item.createdAt) }),
      ])),
    ]));
  } catch {
    // A lista é um extra: sem permissão de leitura, o cadastro continua válido.
    clear(mountPoint);
    mount(mountPoint, el('p', {
      class: 'field__hint mt-4',
      text: 'A lista de cadastros não está disponível (leitura negada pelas Security Rules). O cadastro acima funciona normalmente.',
    }));
  }
}

function clearFeedback() {
  const feedback = $('[data-feedback]');
  if (feedback) clear(feedback);
}

function showFeedback(message, type) {
  const feedback = $('[data-feedback]');
  if (!feedback) return;

  mount(feedback, el('div', { class: `alert alert--${type}`, role: 'alert' }, [
    icon('alert', { size: 16 }),
    message,
  ]));
}

/** Estrutura mínima, caso o HTML não traga o formulário. */
function renderFallback() {
  mount(document.body, el('main', { class: 'cadastro-shell' }, [
    el('div', { class: 'cadastro-card' }, [
      el('p', { class: 'alert alert--error', text: 'O formulário não foi encontrado no HTML.' }),
    ]),
  ]));
}

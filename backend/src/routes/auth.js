/**
 * KyriosStems - backend/src/routes/auth.js
 * Login administrativo.
 *
 * A verificação vive aqui, no servidor: a decisão de quem pode escrever é do
 * backend, que é o único com acesso ao banco.
 */

import { post, get } from '../http/router.js';
import { sendJson, readJsonBody, HttpError } from '../http/respond.js';
import { getAdminByEmail, getAdminById } from '../db/admins.js';
import { verifyPassword } from '../auth/passwords.js';
import { issueToken } from '../auth/tokens.js';

post('/api/auth/login', {
  handler: async ({ request, response, origin }) => {
    const body = await readJsonBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      throw new HttpError(400, 'Informe e-mail e senha.');
    }

    const admin = await getAdminByEmail(email);

    // Verifica a senha mesmo quando o e-mail não existe, para que o tempo de
    // resposta não revele quais e-mails estão cadastrados.
    const stored = admin?.password_hash ?? 'scrypt$16384$8$1$AAAA$AAAA';
    const ok = await verifyPassword(password, stored);

    if (!admin || !ok) {
      throw new HttpError(401, 'E-mail ou senha incorretos.');
    }

    const { token, expiresAt } = issueToken(admin);
    sendJson(response, 200, {
      token,
      expiresAt,
      user: { id: admin.id, email: admin.email },
    }, origin);
  },
});

/** Confirma que o token em uso ainda vale e devolve quem é o administrador. */
get('/api/auth/me', {
  auth: true,
  handler: async ({ response, admin, origin }) => {
    const record = await getAdminById(admin.sub);
    if (!record) throw new HttpError(401, 'Conta não encontrada.');
    sendJson(response, 200, { user: { id: record.id, email: record.email } }, origin);
  },
});
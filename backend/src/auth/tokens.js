/**
 * KyriosStems - backend/src/auth/tokens.js
 * Token de sessão assinado (HMAC-SHA256).
 *
 * Substitui a custom claim `admin` do Firebase Authentication. O token é
 * stateless: o backend confere a assinatura e a validade, sem consultar o
 * banco a cada requisição.
 *
 * Formato: base64url(payload).base64url(assinatura)
 *
 * Não é um JWT completo de propósito: sem cabeçalho com algoritmo negociável
 * não existe o ataque de confundir o verificador sobre qual algoritmo usar. A
 * verificação é sempre HMAC-SHA256 com o segredo do servidor.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { auth } from '../config.js';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64) {
  return createHmac('sha256', auth.jwtSecret).update(payloadB64).digest('base64url');
}

/**
 * Emite um token para um administrador.
 * @param {{id: number|string, email: string}} admin
 */
export function issueToken(admin) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(admin.id),
    email: admin.email,
    iat: now,
    exp: now + auth.tokenTtlSeconds,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  return { token: `${payloadB64}.${sign(payloadB64)}`, expiresAt: payload.exp };
}

/**
 * Verifica um token e devolve o payload, ou null.
 *
 * A comparação da assinatura é em tempo constante para não vazar, pelo tempo
 * de resposta, quantos bytes do MAC estão corretos.
 */
export function verifyToken(token) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = sign(payloadB64);

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return null;
  if (!timingSafeEqual(given, want)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload?.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
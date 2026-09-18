/**
 * KyriosStems - backend/src/auth/passwords.js
 * Hash de senha com scrypt.
 *
 * scrypt é deliberadamente caro em memória, o que encarece ataques de força
 * bruta com hardware dedicado. Os parâmetros ficam gravados junto ao hash para
 * que o custo possa subir depois sem invalidar as senhas existentes.
 */

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Gera o hash de uma senha.
 * Formato: scrypt$N$r$p$salt$hash — autodescritivo.
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('A senha precisa ter ao menos 8 caracteres.');
  }

  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/** Confere uma senha contra um hash armazenado. */
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');

  let derived;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  // Comparação em tempo constante: um `===` vazaria informação pelo tempo de
  // resposta, permitindo descobrir o hash byte a byte.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
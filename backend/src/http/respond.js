/**
 * KyriosStems - backend/src/http/respond.js
 * Respostas HTTP, CORS e leitura do corpo da requisição.
 */

import { server } from '../config.js';

/** Cabeçalhos de CORS, restritos às origens configuradas. */
export function corsHeaders(origin) {
  const allowed = server.allowedOrigins.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : server.allowedOrigins[0] || '',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Envia uma resposta JSON. */
export function sendJson(response, status, payload, origin) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...corsHeaders(origin),
  });
  response.end(body);
}

/** Envia um erro no formato { error: { message } }. */
export function sendError(response, status, message, origin) {
  sendJson(response, status, { error: { message } }, origin);
}

/** Erro com status HTTP, para as rotas sinalizarem o código correto. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Lê e interpreta o corpo JSON.
 * O limite de tamanho evita que um corpo enorme consuma memória do processo:
 * os arquivos não passam por aqui, só metadados.
 */
export async function readJsonBody(request, limitBytes = 1_000_000) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) throw new HttpError(413, 'Corpo da requisição grande demais.');
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Corpo da requisição não é JSON válido.');
  }
}
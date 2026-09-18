/**
 * KyriosStems - backend/src/http/handler.js
 * Tratamento de uma requisição HTTP.
 *
 * Fica separado do servidor para que os testes possam subir um servidor
 * efêmero na mesma lógica que roda em produção, sem duplicar o tratamento de
 * erros nem a montagem de CORS.
 */

import { server } from '../config.js';
import { dispatch } from './router.js';
import { sendError, sendJson, HttpError, corsHeaders } from './respond.js';
import { healthCheck } from '../db/pool.js';
import { DriveError } from '../drive/client.js';

// Registrar as rotas é o que as torna alcançáveis.
import '../routes/auth.js';
import '../routes/songs.js';
import '../routes/drive.js';

export async function handle(request, response) {
  const origin = request.headers.origin || '';

  // A verificação de origem prévia é do navegador; responde-se vazio.
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    const info = await healthCheck();
    sendJson(response, 200, {
      status: 'ok',
      database: { name: info.database, version: info.version.split(',')[0] },
    }, origin);
    return;
  }

  const handled = await dispatch(request, response, { origin });
  if (!handled) sendError(response, 404, 'Rota não encontrada.', origin);
}

/**
 * Converte um erro no status e na mensagem apropriados.
 *
 * Erros previstos levam o próprio status. O resto é 500, e a mensagem crua só
 * aparece no log: devolvê-la ao cliente exporia detalhes internos.
 */
export function errorResponse(error) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }

  if (error instanceof DriveError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    return { status, message: error.message };
  }

  // Restrições do banco viram 400 com o nome da restrição violada, porque a
  // causa costuma ser um campo inválido enviado pela interface.
  if (error?.code === '23514' || error?.code === '23502') {
    return {
      status: 400,
      message: `Valor inválido para o campo (${error.constraint || 'restrição do banco'}).`,
    };
  }
  if (error?.code === '23505') {
    return { status: 409, message: 'Já existe um registro com esses dados.' };
  }
  if (error?.code === '23503') {
    return { status: 400, message: 'Referência inexistente: a música informada não existe.' };
  }

  console.error('[erro]', error);
  return { status: 500, message: 'Erro interno no servidor.' };
}

/** Envolve `handle` com o tratamento de erros, pronto para o `createServer`. */
export function requestListener() {
  return (request, response) => {
    handle(request, response).catch((error) => {
      const { status, message } = errorResponse(error);
      sendError(response, status, message, request.headers.origin || '');
    });
  };
}

export { server };
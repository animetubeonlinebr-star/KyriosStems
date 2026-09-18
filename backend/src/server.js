/**
 * KyriosStems - backend/src/server.js
 * Servidor HTTP da API.
 *
 * Depende apenas do Node: nenhum framework. A API tem poucas rotas e o
 * roteador é próprio, o que mantém a superfície pequena e auditável — a mesma
 * razão pela qual o frontend não tem etapa de build.
 */

import { createServer } from 'node:http';
import { server } from './config.js';
import { requestListener } from './http/handler.js';
import { closePool } from './db/pool.js';

const instance = createServer(requestListener());

instance.listen(server.port, () => {
  console.log(`KyriosStems API em http://localhost:${server.port}`);
  console.log(`Origens autorizadas: ${server.allowedOrigins.join(', ')}`);
  console.log(`Download público: ${server.publicDownload ? 'sim' : 'não (exige token)'}`);
});

/** Desligamento ordenado: fecha o pool antes de encerrar o processo. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} recebido, encerrando...`);
    instance.close(async () => {
      await closePool();
      process.exit(0);
    });
  });
}

export { instance };
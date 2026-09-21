/**
 * KyriosStems - backend/src/env.js
 * Carrega backend/.env, quando existir.
 *
 * Em produção as variáveis vêm do ambiente do provedor e não há arquivo .env.
 * Em desenvolvimento o arquivo é conveniente. Este módulo precisa ser importado
 * antes de `config.js`, que lê o ambiente na inicialização.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, '..', '.env');

if (existsSync(ENV_FILE)) {
  // disponível a partir do Node 20.12.
  process.loadEnvFile(ENV_FILE);
}
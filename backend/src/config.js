/**
 * KyriosStems - backend/src/config.js
 * Configuração do backend, lida exclusivamente do ambiente.
 *
 * Nenhum segredo tem valor padrão: uma variável ausente derruba a inicialização
 * em vez de cair para um valor de desenvolvimento que vazaria para produção.
 */

// Primeira importação do módulo: as demais constantes deste arquivo leem o
// ambiente na inicialização, então o .env precisa estar carregado antes.
import './env.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CERT_DIR = join(HERE, '..', 'certs');

/**
 * Lê uma variável obrigatória. Falha cedo, com o nome da variável, em vez de
 * deixar um `undefined` virar erro obscuro no meio de uma requisição.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Copie backend/.env.example para backend/.env e preencha.`,
    );
  }
  return value;
}

function optional(name, fallback = null) {
  return process.env[name] || fallback;
}

/**
 * Banco de dados Aiven PostgreSQL.
 *
 * `sslRootCert` aponta para a Project CA do Aiven. O certificado é autoassinado,
 * então o repositório de CAs do sistema não o reconhece: sem este arquivo a
 * conexão falha, e desativar a verificação não é uma opção.
 */
export const database = {
  host: required('KYRIOS_DB_HOST'),
  port: Number(optional('KYRIOS_DB_PORT', '25580')),
  database: required('KYRIOS_DB_NAME'),
  user: required('KYRIOS_DB_USER'),
  password: required('KYRIOS_DB_PASSWORD'),
  caPath: optional('KYRIOS_DB_CA_PATH', join(CERT_DIR, 'aiven-ca.pem')),
  get ca() {
    return readFileSync(this.caPath, 'utf8');
  },
};

/** Servidor HTTP. */
export const server = {
  port: Number(optional('KYRIOS_PORT', '8080')),
  /**
   * Origens autorizadas a chamar a API. O GitHub Pages publica em um domínio
   * diferente do backend, então CORS é obrigatório. Lista explícita: `*`
   * permitiria que qualquer site usasse a API com as credenciais do usuário.
   */
  allowedOrigins: optional('KYRIOS_ALLOWED_ORIGINS', 'http://localhost:12000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * Download do pacote liberado para qualquer visitante.
   *
   * O catálogo já é público e o download é o propósito do sistema. A pasta no
   * Drive é privada: quem entrega os bytes é o backend, mediante o id do
   * arquivo.
   *
   * Defina como `false` para exigir o token de administrador também no
   * download — útil se a biblioteca deixar de ser pública.
   */
  publicDownload: optional('KYRIOS_PUBLIC_DOWNLOAD', 'true') !== 'false',
};

/** Autenticação administrativa. */
export const auth = {
  /** Segredo de assinatura dos tokens de sessão. */
  jwtSecret: required('KYRIOS_JWT_SECRET'),
  /** Validade do token de sessão, em segundos (padrão: 12 horas). */
  tokenTtlSeconds: Number(optional('KYRIOS_TOKEN_TTL', '43200')),
};

/**
 * Google Drive.
 *
 * A biblioteca é privada, então o acesso se dá pela identidade de uma conta
 * dedicada ao KyriosStems: o backend guarda o refresh token e troca por um
 * access token de curta duração a cada chamada.
 */
export const drive = {
  clientId: required('KYRIOS_DRIVE_CLIENT_ID'),
  clientSecret: required('KYRIOS_DRIVE_CLIENT_SECRET'),
  refreshToken: required('KYRIOS_DRIVE_REFRESH_TOKEN'),
  /** Pasta raiz da biblioteca no Drive. */
  rootFolderId: required('KYRIOS_DRIVE_FOLDER_ID'),
};

/** Indica se o backend está configurado para falar com o Drive. */
export function isDriveConfigured() {
  return Boolean(drive.clientId && drive.clientSecret && drive.refreshToken && drive.rootFolderId);
}

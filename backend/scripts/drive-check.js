/**
 * KyriosStems - backend/scripts/drive-check.js
 * Confere a configuração do Google Drive.
 *
 * Valida, em ordem, o que costuma estar errado: as variáveis presentes, a troca
 * do refresh token por access token, o acesso à pasta raiz e a permissão de
 * escrita (cria e remove uma pasta de teste).
 *
 * Uso:
 *   node scripts/drive-check.js
 */

import { isDriveConfigured, drive } from '../src/config.js';
import { ping, createFolder, trashFile, DriveError } from '../src/drive/client.js';

async function main() {
  if (!isDriveConfigured()) {
    console.error('Drive não configurado. Preencha as variáveis KYRIOS_DRIVE_* em backend/.env');
    process.exit(1);
  }

  console.log('1. Pasta raiz');
  const root = await ping();
  console.log(`   ok  "${root.name}" (${root.id})`);

  if (root.mimeType !== 'application/vnd.google-apps.folder') {
    console.error('   A pasta raiz configurada não é uma pasta.');
    process.exit(1);
  }

  console.log('\n2. Permissão de escrita');
  const testName = `kyriosstems_teste_${Date.now()}`;
  const folderId = await createFolder(testName, drive.rootFolderId);
  console.log(`   ok  pasta de teste criada (${folderId})`);

  await trashFile(folderId);
  console.log('   ok  pasta de teste removida');

  console.log('\nConfiguração do Drive está funcional.');
}

main().catch((error) => {
  console.error('\nFalha:', error.message);
  if (error instanceof DriveError && error.status === 403) {
    console.error('\nA conta não tem permissão de escrita nesta pasta.');
    console.error('Confirme que a pasta raiz está compartilhada com a conta dedicada');
    console.error('com papel de Editor, e que a Drive API está ativa no projeto.');
  }
  if (/invalid_grant/.test(error.message)) {
    console.error('\nGere um novo refresh token para a conta dedicada do KyriosStems.');
  }
  process.exit(1);
});
/**
 * KyriosStems - backend/scripts/create-admin.js
 * Cria ou redefine a senha de um administrador.
 *
 * A autorização é um registro no banco, com senha em hash.
 *
 * Uso:
 *   node scripts/create-admin.js admin@exemplo.com
 *   node scripts/create-admin.js admin@exemplo.com --password "SuaSenha"
 *
 * Sem --password, a senha é lida do terminal sem eco, para não ficar no
 * histórico do shell nem aparecer na lista de processos.
 */

import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../src/auth/passwords.js';
import { upsertAdmin, countAdmins } from '../src/db/admins.js';
import { closePool } from '../src/db/pool.js';

/** Lê uma linha do terminal sem ecoar o que é digitado. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });

    // Sobrescreve a escrita para não devolver os caracteres à tela.
    const write = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (text) => {
      if (text.includes(question)) write(text);
    };

    rl.question(question, (answer) => {
      rl.close();
      stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((arg) => !arg.startsWith('--'));

  if (!email) {
    console.error('Uso: node scripts/create-admin.js <email> [--password "senha"]');
    process.exit(1);
  }

  const flagIndex = args.indexOf('--password');
  let password = flagIndex >= 0 ? args[flagIndex + 1] : null;

  if (!password) {
    password = await askHidden(`Senha para ${email}: `);
    const confirmation = await askHidden('Confirme a senha: ');
    if (password !== confirmation) {
      console.error('\nAs senhas não coincidem.');
      process.exit(1);
    }
  }

  if (!password || password.length < 8) {
    console.error('\nA senha precisa ter ao menos 8 caracteres.');
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const admin = await upsertAdmin(email, hash);

  console.log(`\nAdministrador pronto: ${admin.email} (id ${admin.id})`);
  console.log(`Total de administradores: ${await countAdmins()}`);
}

main()
  .then(() => closePool())
  .catch(async (error) => {
    console.error('\nFalha:', error.message);
    await closePool();
    process.exit(1);
  });
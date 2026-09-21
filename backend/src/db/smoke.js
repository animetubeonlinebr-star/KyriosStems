/**
 * KyriosStems - backend/src/db/smoke.js
 * Verificação de conectividade com o Aiven.
 *
 * Confirma três coisas que, juntas, garantem que a configuração está correta:
 *   1. o TLS é validado com a Project CA (rejectUnauthorized: true)
 *   2. a credencial autentica
 *   3. o esquema já foi aplicado
 *
 * Uso:
 *   node src/db/smoke.js
 */

import '../env.js';
import { healthCheck, query, closePool } from './pool.js';

async function main() {
  const info = await healthCheck();
  console.log('Conexão: ok');
  console.log('  banco :', info.database);
  console.log('  usuário:', info.user);
  console.log('  versão :', info.version.split(',')[0]);

  const { rows } = await query(`
    select table_name
      from information_schema.tables
     where table_schema = 'public'
     order by table_name
  `);

  console.log('\nTabelas em public:');
  if (!rows.length) {
    console.log('  (nenhuma — rode: node src/db/migrate.js)');
  } else {
    for (const row of rows) console.log('  -', row.table_name);
  }
}

main()
  .then(() => closePool())
  .catch(async (error) => {
    console.error('\nFalha:', error.message);
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || /self.signed/i.test(error.message)) {
      console.error('\nO TLS não foi validado. Verifique KYRIOS_DB_CA_PATH e se');
      console.error('backend/certs/aiven-ca.pem corresponde à CA do projeto no Aiven.');
    }
    if (error.code === '28P01') console.error('\nSenha incorreta (KYRIOS_DB_PASSWORD).');
    await closePool();
    process.exit(1);
  });
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sqlPath = resolve(process.cwd(), 'db/migrations/0001_initial_schema.sql');
console.log(`Aplicando migração: ${sqlPath}`);

try {
  const content = readFileSync(sqlPath, 'utf8');
  execSync('docker exec -i gestfrota-postgres psql -U postgres -d gestfrota_dev', {
    input: content,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  console.log('Migração 0001_initial_schema.sql aplicada com sucesso!');
} catch (err) {
  console.error('Falha ao aplicar migração:', err);
  process.exit(1);
}

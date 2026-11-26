import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const testSqlPath = resolve(process.cwd(), 'db/tests/test_invariants.sql');
console.log(`Executando testes de invariantes: ${testSqlPath}`);

try {
  const content = readFileSync(testSqlPath, 'utf8');
  execSync('docker exec -i -e PGCLIENTENCODING=UTF8 gestfrota-postgres psql -U postgres -d gestfrota_dev', {
    input: content,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  console.log('Todos os testes de invariantes foram executados e aprovados!');
} catch (err) {
  console.error('Falha na execução dos testes de banco:', err);
  process.exit(1);
}

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDir = resolve(process.cwd(), 'db/migrations');
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log(`Aplicando ${files.length} migrações...`);

for (const file of files) {
  const filePath = resolve(migrationsDir, file);
  console.log(`-> Aplicando ${file}`);
  const content = readFileSync(filePath, 'utf8');
  execSync('docker exec -i gestfrota-postgres psql -U postgres -d gestfrota_dev', {
    input: content,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

console.log('Todas as migrações foram aplicadas com sucesso!');

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const seedsDir = resolve(process.cwd(), 'db/seeds');
const files = readdirSync(seedsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log(`Aplicando ${files.length} arquivo(s) de semente/demo...`);

for (const file of files) {
  const filePath = resolve(seedsDir, file);
  console.log(`-> Aplicando ${file}`);
  const content = readFileSync(filePath, 'utf8');
  execSync('docker exec -i -e PGCLIENTENCODING=UTF8 gestfrota-postgres psql -U postgres -d gestfrota_dev', {
    input: content,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

console.log('Dados de demonstração aplicados com sucesso!');

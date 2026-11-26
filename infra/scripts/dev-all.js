import { execSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const CORES = {
  reset: '\x1b[0m',
  verde: '\x1b[32m',
  ciano: '\x1b[36m',
  amarelo: '\x1b[33m',
  magenta: '\x1b[35m',
  azul: '\x1b[34m',
  vermelho: '\x1b[31m',
  negrito: '\x1b[1m',
};

const SERVICOS = [
  { nome: 'API   ', cor: CORES.verde, filtro: '@gestfrota/api' },
  { nome: 'WORKER', cor: CORES.amarelo, filtro: '@gestfrota/worker' },
  { nome: 'GESTAO', cor: CORES.ciano, filtro: '@gestfrota/gestao' },
  { nome: 'CAMPO ', cor: CORES.magenta, filtro: '@gestfrota/campo' },
];

function logSistema(msg, cor = CORES.azul) {
  console.log(`${cor}${CORES.negrito}[SISTEMA]${CORES.reset} ${msg}`);
}

function prefixarSaida(stream, prefixo, cor) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const linhas = buffer.split(/\r?\n/);
    buffer = linhas.pop() ?? '';
    for (const linha of linhas) {
      if (linha.length > 0) {
        console.log(`${cor}[${prefixo}]${CORES.reset} ${linha}`);
      }
    }
  });
  stream.on('end', () => {
    if (buffer.length > 0) {
      console.log(`${cor}[${prefixo}]${CORES.reset} ${buffer}`);
    }
  });
}

async function garantirBancoAtivo() {
  logSistema('Verificando Docker e container PostgreSQL (gestfrota-postgres)...');
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 8000 });
  } catch {
    console.error(
      `${CORES.vermelho}${CORES.negrito}[ERRO]${CORES.reset} Docker Desktop não está respondendo.`
    );
    console.error('Abra o Docker Desktop no Windows, aguarde ficar VERDE ("Engine running") e tente novamente.');
    process.exit(1);
  }

  let rodando = false;
  try {
    const status = execSync(
      'docker inspect -f "{{.State.Running}}" gestfrota-postgres',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }
    ).trim();
    rodando = status === 'true';
  } catch {
    rodando = false;
  }

  if (!rodando) {
    logSistema('Subindo container PostgreSQL na porta 5433...', CORES.amarelo);
    execSync('docker compose -f infra/docker/docker-compose.yml up -d', {
      stdio: 'inherit',
      timeout: 120000,
    });
  } else {
    logSistema('Container gestfrota-postgres já está ativo.', CORES.verde);
  }

  logSistema('Aguardando PostgreSQL aceitar conexões...');
  for (let tentativa = 1; tentativa <= 20; tentativa++) {
    try {
      execSync('docker exec gestfrota-postgres pg_isready -U postgres -d gestfrota_dev', {
        stdio: 'ignore',
        timeout: 4000,
      });
      logSistema('PostgreSQL 17 pronto na porta 5433!', CORES.verde);
      return;
    } catch {
      await delay(1000);
    }
  }

  console.error(`${CORES.vermelho}[ERRO]${CORES.reset} PostgreSQL não respondeu a tempo.`);
  process.exit(1);
}

function encerrarArvore(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      return;
    } catch {
      // Fallback para kill padrão
    }
  }
  try {
    child.kill('SIGTERM');
  } catch {
    // Ignora se já encerrado
  }
}

async function main() {
  await garantirBancoAtivo();

  console.log('');
  logSistema('Iniciando todos os 4 módulos do GestFrota nesta janela:', CORES.verde);
  console.log('  • Painel de Gestão Web: http://localhost:5173  (admin@demo.gov.br)');
  console.log('  • PWA de Campo:         http://localhost:5174  (motorista@demo.gov.br / frentista@demo.gov.br)');
  console.log('  • API Fastify Swagger:  http://localhost:3000/docs');
  console.log('  • Worker pg-boss:       em segundo plano');
  console.log('  Pressione Ctrl + C para encerrar todos os serviços.\n');

  const processos = [];
  let encerrando = false;

  const finalizarTudo = (codigo = 0) => {
    if (encerrando) return;
    encerrando = true;
    console.log('');
    logSistema('Encerrando todos os serviços do GestFrota...', CORES.amarelo);
    for (const p of processos) {
      encerrarArvore(p);
    }
    process.exit(codigo);
  };

  process.on('SIGINT', () => finalizarTudo(0));
  process.on('SIGTERM', () => finalizarTudo(0));

  for (const srv of SERVICOS) {
    const child = spawn('pnpm', ['--filter', srv.filtro, 'dev'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    prefixarSaida(child.stdout, srv.nome, srv.cor);
    prefixarSaida(child.stderr, srv.nome, srv.cor);

    child.on('exit', (code) => {
      if (!encerrando && code !== 0 && code !== null) {
        logSistema(`Serviço ${srv.nome.trim()} encerrou com código ${code}.`, CORES.vermelho);
      }
    });

    processos.push(child);
  }
}

main().catch((err) => {
  console.error(`${CORES.vermelho}[ERRO]${CORES.reset}`, err);
  process.exit(1);
});

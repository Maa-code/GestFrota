import PgBoss from 'pg-boss';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { executarExpiracaoAutorizacoes } from './jobs/expirarAutorizacoes.js';
import { executarRenovacaoCotasMensais } from './jobs/renovarCotasMensais.js';
import { executarGeracaoAncorasAuditoria } from './jobs/gerarAncorasAuditoria.js';
import { executarProcessamentoOutbox } from './jobs/processarOutbox.js';

export interface WorkerOptions {
  enableScheduler?: boolean;
}

export class GestFrotaWorker {
  private boss?: PgBoss;
  private intervalIds: NodeJS.Timeout[] = [];
  private isRunning = false;

  constructor(private connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/gestfrota_dev') {}

  async start(options: WorkerOptions = { enableScheduler: true }) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[GestFrota Worker] Inicializando serviços e filas...');

    try {
      this.boss = new PgBoss({
        connectionString: this.connectionString,
        schema: 'pgboss',
      });

      this.boss.on('error', (err) => {
        console.error('[pg-boss] Erro na fila:', err);
      });

      await this.boss.start();
      console.log('[pg-boss] Fila transacional conectada com sucesso.');

      // Registrar handlers do pg-boss
      await this.boss.work('expirar-autorizacoes', async () => {
        const res = await executarExpiracaoAutorizacoes();
        return res;
      });

      await this.boss.work('renovar-cotas-mensais', async () => {
        const res = await executarRenovacaoCotasMensais();
        return res;
      });

      await this.boss.work('gerar-ancoras-auditoria', async () => {
        const res = await executarGeracaoAncorasAuditoria();
        return res;
      });

      await this.boss.work('processar-outbox', async () => {
        const res = await executarProcessamentoOutbox();
        return res;
      });

      // Agendamento periódico de jobs no pg-boss
      if (options.enableScheduler) {
        // Expirar autorizações a cada 1 minuto
        await this.boss.schedule('expirar-autorizacoes', '* * * * *');
        // Processar outbox a cada 10 segundos
        await this.boss.schedule('processar-outbox', '*/1 * * * * *');
        // Renovar cotas todo dia 1º à meia-noite (0 0 1 * *)
        await this.boss.schedule('renovar-cotas-mensais', '0 0 1 * *');
        // Selar âncoras de auditoria diariamente à 01:00 (0 1 * * *)
        await this.boss.schedule('gerar-ancoras-auditoria', '0 1 * * *');
        console.log('[GestFrota Worker] Jobs agendados com sucesso no pg-boss.');
      }
    } catch (err) {
      console.warn('[pg-boss] Aviso: pg-boss operando em modo fallback local:', err);
      // Fallback em loop local para ambientes com restrição de schema
      if (options.enableScheduler) {
        this.intervalIds.push(setInterval(() => executarExpiracaoAutorizacoes().catch(console.error), 30000));
        this.intervalIds.push(setInterval(() => executarProcessamentoOutbox().catch(console.error), 10000));
      }
    }
  }

  async stop() {
    this.isRunning = false;
    for (const id of this.intervalIds) {
      clearInterval(id);
    }
    this.intervalIds = [];

    if (this.boss) {
      await this.boss.stop();
    }
    await pool.end();
    console.log('[GestFrota Worker] Worker encerrado com sucesso.');
  }
}

// Inicia se executado diretamente
const isMain = process.argv[1] && (
  process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts')
);

if (isMain && process.env.NODE_ENV !== 'test') {
  const worker = new GestFrotaWorker();
  worker.start().catch((err) => {
    console.error('[GestFrota Worker] Falha ao iniciar:', err);
    process.exit(1);
  });

  const shutdown = async () => {
    console.log('\n[GestFrota Worker] Encerrando graciosamente...');
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

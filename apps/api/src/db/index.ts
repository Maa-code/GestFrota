import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/gestfrota_dev',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

/**
 * Executa uma operação no banco de dados sob o contexto de um Tenant (ente_id)
 * garantindo o isolamento multiente via Row Level Security (RLS) e transação segura.
 */
export async function withTenant<T>(
  enteId: string | null,
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (enteId) {
      // Injeta contexto para app_current_ente_id() no RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_ente_id', enteId]);
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Consulta simples (somente leitura ou sem necessidade de transação multi-statement)
 */
export async function queryTenant<T extends pg.QueryResultRow = any>(
  enteId: string | null,
  text: string,
  params: any[] = []
): Promise<pg.QueryResult<T>> {
  return withTenant(enteId, async (client) => {
    return client.query<T>(text, params);
  });
}

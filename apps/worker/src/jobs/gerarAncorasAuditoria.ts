import crypto from 'node:crypto';
import { query, withTenant } from '../db.js';

export interface ResultadoAncoragem {
  dataAncora: string;
  ancorasCriadas: number;
}

/**
 * Seção 5.3 / 12: Geração de Âncoras Diárias da Trilha de Auditoria Encadeada com SHA-256.
 * Consolida e sela todos os eventos de auditoria ocorridos no dia anterior por ente.
 */
export async function executarGeracaoAncorasAuditoria(
  dataAlvoIso?: string
): Promise<ResultadoAncoragem> {
  // Data alvo padrão: dia anterior
  const data = dataAlvoIso || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const entesRes = await query(`SELECT id FROM entes WHERE ativo = true`);
  let ancorasCriadas = 0;

  for (const ente of entesRes.rows) {
    const enteId = ente.id;

    await withTenant(enteId, async (client) => {
      // Verifica se a âncora já foi gerada para esta data
      const checkRes = await client.query(`
        SELECT 1 FROM auditoria_ancoras WHERE ente_id = $1 AND data_ancora = $2
      `, [enteId, data]);

      if (checkRes.rows.length > 0) {
        return; // Já ancorado
      }

      // Busca eventos do dia para o ente
      const eventosRes = await client.query(`
        SELECT id, hash_atual
        FROM auditoria
        WHERE ente_id = $1
          AND criado_em >= $2::date
          AND criado_em < ($2::date + interval '1 day')
        ORDER BY id ASC
      `, [enteId, data]);

      if (eventosRes.rows.length === 0) {
        return; // Sem eventos no dia
      }

      const totalEventos = eventosRes.rows.length;
      const primeiroId = eventosRes.rows[0].id;
      const ultimoId = eventosRes.rows[totalEventos - 1].id;

      // Calcula Merkle / Root Hash combinando todos os hashes do dia em ordem
      const hashStream = crypto.createHash('sha256');
      for (const ev of eventosRes.rows) {
        hashStream.update(ev.hash_atual);
      }
      const hashRaizSha256 = hashStream.digest('hex');

      // Grava a âncora diária
      await client.query(`
        INSERT INTO auditoria_ancoras (
          ente_id, data_ancora, total_eventos, primeiro_id, ultimo_id, hash_raiz_sha256
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [enteId, data, totalEventos, primeiroId, ultimoId, hashRaizSha256]);

      ancorasCriadas++;
    });
  }

  return {
    dataAncora: data,
    ancorasCriadas,
  };
}

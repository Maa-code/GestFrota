import { query, withTenant } from '../db.js';

export interface ResultadoExpiracao {
  expiradas: number;
  autorizacoes: string[];
}

/**
 * D-01 / D-05: Rotina de expiração de autorizações não consumidas.
 * Localiza autorizações RESERVADAS cujo prazo de validade expirou,
 * executa no banco a liberação de cotas e altera o status para EXPIRADA.
 */
export async function executarExpiracaoAutorizacoes(): Promise<ResultadoExpiracao> {
  // Busca autorizações expiradas que ainda estão como RESERVADAS
  const res = await query(`
    SELECT a.id, a.ente_id, a.codigo_abt, a.litros_solicitados, a.validade_limite
    FROM autorizacoes a
    WHERE a.status = 'RESERVADA'
      AND a.validade_limite < now()
    ORDER BY a.validade_limite ASC
    LIMIT 100
  `);

  const autorizacoesExpiradas: string[] = [];

  for (const aut of res.rows) {
    await withTenant(aut.ente_id, async (client) => {
      // 1. Libera a reserva no razão imutável
      await client.query(`
        SELECT liberar_reserva_veiculo($1, $2, $3)
      `, [
        aut.id, 
        aut.ente_id, 
        `Autorização ${aut.codigo_abt} expirada automaticamente por decurso de prazo`
      ]);

      // 2. Atualiza status da autorização
      await client.query(`
        UPDATE autorizacoes
        SET status = 'EXPIRADA'
        WHERE id = $1
      `, [aut.id]);

      // 3. Registra evento no outbox para notificação
      await client.query(`
        INSERT INTO outbox (ente_id, canal, topico, payload)
        VALUES ($1, 'NOTIFICACAO_SISTEMA', 'AUTORIZACAO_EXPIRADA', $2)
      `, [
        aut.ente_id,
        JSON.stringify({
          autorizacaoId: aut.id,
          codigoAbt: aut.codigo_abt,
          litrosLiberados: aut.litros_solicitados,
          motivo: 'Prazo limite atingido sem abastecimento'
        })
      ]);
    });

    autorizacoesExpiradas.push(aut.id);
  }

  return {
    expiradas: autorizacoesExpiradas.length,
    autorizacoes: autorizacoesExpiradas,
  };
}

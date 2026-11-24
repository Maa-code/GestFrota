import { query, withTenant } from '../db.js';

export interface ResultadoProcessamentoOutbox {
  processados: number;
  falhas: number;
}

/**
 * Princípio 6 da Seção 5.2: Outbox transacional.
 * Lê eventos pendentes da tabela outbox e os processa de forma confiável.
 */
export async function executarProcessamentoOutbox(): Promise<ResultadoProcessamentoOutbox> {
  // Busca mensagens pendentes com travamento concorrente SKIP LOCKED
  const pendentesRes = await query(`
    SELECT id, ente_id, canal, topico, payload, tentativas, max_tentativas
    FROM outbox
    WHERE status IN ('PENDENTE', 'FALHA')
      AND agendado_para <= now()
      AND tentativas < max_tentativas
    ORDER BY agendado_para ASC
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  `);

  let processados = 0;
  let falhas = 0;

  for (const item of pendentesRes.rows) {
    try {
      await withTenant(item.ente_id, async (client) => {
        // Exemplo de despacho interno: se for notificação, cria na tabela notificacoes
        if (item.canal.startsWith('NOTIFICACAO')) {
          const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
          
          if (payload.usuarioId) {
            await client.query(`
              INSERT INTO notificacoes (ente_id, usuario_id, titulo, mensagem, tipo)
              VALUES ($1, $2, $3, $4, $5)
            `, [
              item.ente_id,
              payload.usuarioId,
              payload.titulo || 'Notificação do Sistema',
              payload.mensagem || JSON.stringify(payload),
              payload.tipo || 'INFO'
            ]);
          }
        }

        // Marca como PROCESSADO com sucesso
        await client.query(`
          UPDATE outbox
          SET status = 'PROCESSADO',
              processado_em = now(),
              tentativas = tentativas + 1
          WHERE id = $1
        `, [item.id]);
      });

      processados++;
    } catch (err: any) {
      falhas++;
      await query(`
        UPDATE outbox
        SET status = CASE WHEN tentativas + 1 >= max_tentativas THEN 'FALHA' ELSE 'PENDENTE' END,
            tentativas = tentativas + 1,
            erro_ultimo = $2,
            agendado_para = now() + (interval '1 minute' * (tentativas + 1))
        WHERE id = $1
      `, [item.id, err.message]);
    }
  }

  return {
    processados,
    falhas,
  };
}

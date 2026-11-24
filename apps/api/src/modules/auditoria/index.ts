import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryTenant } from '../../db/index.js';
import { requireAuth } from '../auth/index.js';

export async function auditoriaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth());

  // Listar eventos e âncoras de auditoria do ente ativo
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;

    const [eventosRes, ancorasRes] = await Promise.all([
      queryTenant(enteId, `
        SELECT id, entidade, entidade_id, acao, dados_novos, hash_anterior, hash_atual, criado_em
        FROM auditoria
        WHERE ente_id = $1 OR ente_id IS NULL
        ORDER BY id DESC
        LIMIT 50
      `, [enteId]),
      queryTenant(enteId, `
        SELECT id, data_ancora, total_eventos, primeiro_id, ultimo_id, hash_raiz_sha256, criado_em
        FROM auditoria_ancoras
        WHERE ente_id = $1
        ORDER BY data_ancora DESC
        LIMIT 30
      `, [enteId]),
    ]);

    return reply.send({
      eventos: eventosRes.rows,
      ancoras: ancorasRes.rows,
    });
  });
}

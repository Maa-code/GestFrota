import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CriarSecretariaSchema } from '@gestfrota/contratos';
import { queryTenant, withTenant } from '../../db/index.js';
import { requireAuth, requireRoles } from '../auth/index.js';

export async function organizacaoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth());

  // Listar secretarias do ente ativo (RLS garantido)
  fastify.get('/secretarias', async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const res = await queryTenant(enteId, `
      SELECT s.id, s.nome, s.sigla, s.ativo, ug.nome as unidade_gestora_nome
      FROM secretarias s
      JOIN unidades_gestoras ug ON ug.id = s.unidade_gestora_id
      WHERE s.ativo = true
      ORDER BY s.nome ASC
    `);
    return reply.send(res.rows);
  });

  // Criar secretaria
  fastify.post('/secretarias', {
    preHandler: [requireRoles(['ADMIN_GERAL', 'GESTOR_GERAL'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = CriarSecretariaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.errors });
    }

    const { unidadeGestoraId, nome, sigla } = parse.data;
    const enteId = request.enteId!;

    const result = await withTenant(enteId, async (client) => {
      const res = await client.query(`
        INSERT INTO secretarias (ente_id, unidade_gestora_id, nome, sigla)
        VALUES ($1, $2, $3, $4)
        RETURNING id, nome, sigla, ativo, criado_em
      `, [enteId, unidadeGestoraId, nome, sigla]);
      return res.rows[0];
    });

    return reply.status(201).send(result);
  });
}

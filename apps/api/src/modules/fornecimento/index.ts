import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryTenant } from '../../db/index.js';
import { requireAuth } from '../auth/index.js';

export async function fornecimentoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth());

  // Listar postos credenciados do ente
  fastify.get('/postos', async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const res = await queryTenant(enteId, `
      SELECT p.id, p.nome, p.cnpj, p.endereco, p.ativo,
             f.razao_social as fornecedor_nome
      FROM postos p
      JOIN fornecedores f ON f.id = p.fornecedor_id
      WHERE p.ativo = true
      ORDER BY p.nome ASC
    `);
    return reply.send(res.rows);
  });

  // Listar contratos ativos com preços vigentes
  fastify.get('/contratos', async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const res = await queryTenant(enteId, `
      SELECT DISTINCT ON (c.id, ci.id)
             c.id, c.numero_contrato, c.ano, c.data_inicio, c.data_fim, c.valor_total,
             f.razao_social as fornecedor_nome,
             ci.id as contrato_item_id, ci.produto, ci.quantidade_licitada,
             cp.preco_unitario as preco_vigente
      FROM contratos c
      JOIN fornecedores f ON f.id = c.fornecedor_id
      JOIN contrato_itens ci ON ci.contrato_id = c.id
      JOIN contrato_precos cp ON cp.contrato_item_id = ci.id AND cp.vigencia_fim IS NULL
      WHERE c.ativo = true
      ORDER BY c.id, ci.id, cp.vigencia_inicio DESC
    `);
    return reply.send(res.rows);
  });
}

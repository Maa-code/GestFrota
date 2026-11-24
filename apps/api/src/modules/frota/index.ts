import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CriarVeiculoSchema } from '@gestfrota/contratos';
import { queryTenant, withTenant } from '../../db/index.js';
import { requireAuth, requireRoles } from '../auth/index.js';

export async function frotaRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth());

  // Listar veículos do ente
  fastify.get('/veiculos', async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const res = await queryTenant(enteId, `
      SELECT v.id, v.placa, v.marca_modelo, v.ano_fabricacao, v.tipo, 
             v.tipo_medidor, v.capacidade_tanque_litros, v.combustivel_padrao,
             s.nome as secretaria_nome, s.sigla as secretaria_sigla
      FROM veiculos v
      JOIN secretarias s ON s.id = v.secretaria_id
      WHERE v.ativo = true
      ORDER BY v.placa ASC
    `);
    return reply.send(res.rows);
  });

  // Cadastrar veículo (D-11: capacidade do tanque obrigatória)
  fastify.post('/veiculos', {
    preHandler: [requireRoles(['ADMIN_GERAL', 'GESTOR_GERAL', 'GESTOR_SECRETARIA'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = CriarVeiculoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.errors });
    }

    const d = parse.data;
    const enteId = request.enteId!;

    const result = await withTenant(enteId, async (client) => {
      const res = await client.query(`
        INSERT INTO veiculos (
          ente_id, secretaria_id, placa, marca_modelo, ano_fabricacao, 
          tipo, tipo_medidor, capacidade_tanque_litros, combustivel_padrao
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, placa, marca_modelo, capacidade_tanque_litros, combustivel_padrao, criado_em
      `, [
        enteId, d.secretariaId, d.placa, d.marcaModelo, d.anoFabricacao,
        d.tipo, d.tipoMedidor, d.capacidadeTanqueLitros, d.combustivelPadrao
      ]);
      return res.rows[0];
    });

    return reply.status(201).send(result);
  });

  // Listar motoristas
  fastify.get('/motoristas', async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const res = await queryTenant(enteId, `
      SELECT m.id, m.numero_cnh, m.categoria_cnh, m.cnh_validade, m.bloqueado,
             u.nome, u.cpf, u.email, u.telefone
      FROM motoristas m
      JOIN usuarios u ON u.id = m.usuario_id
      ORDER BY u.nome ASC
    `);
    return reply.send(res.rows);
  });
}

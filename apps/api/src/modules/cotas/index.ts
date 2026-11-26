import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  SolicitarAutorizacaoSchema, 
  ConfirmarFrentistaSchema, 
  ConfirmarMotoristaSchema 
} from '@gestfrota/contratos';
import { queryTenant, withTenant } from '../../db/index.js';
import { requireAuth, requireRoles } from '../auth/index.js';

export async function cotasRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth());

  // 1. Extrato de Cotas e Razão Imutável do Veículo (D-01)
  fastify.get('/veiculo/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const veiculoId = request.params.id;

    const cotasRes = await queryTenant(enteId, `
      SELECT cv.id, cv.competencia_ano, cv.competencia_mes, cv.tipo_combustivel,
             cv.origem, cv.limite_litros, cv.saldo_disponivel_litros, cv.saldo_reservado_litros
      FROM cotas_veiculo cv
      WHERE cv.veiculo_id = $1
      ORDER BY cv.competencia_ano DESC, cv.competencia_mes DESC
    `, [veiculoId]);

    const movimentosRes = await queryTenant(enteId, `
      SELECT mc.id, mc.tipo, mc.litros, mc.saldo_anterior, mc.saldo_posterior,
             mc.justificativa, mc.criado_em, mc.autorizacao_id
      FROM movimentos_cota mc
      JOIN cotas_veiculo cv ON cv.id = mc.cota_veiculo_id
      WHERE cv.veiculo_id = $1
      ORDER BY mc.id DESC
      LIMIT 100
    `, [veiculoId]);

    return reply.send({
      cotas: cotasRes.rows,
      movimentos: movimentosRes.rows,
    });
  });

  // 2. Solicitar Autorização de Abastecimento (Motorista - D-05 / D-01 / D-12)
  fastify.post('/solicitar-abastecimento', {
    preHandler: [requireRoles(['MOTORISTA', 'GESTOR_GERAL'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = SolicitarAutorizacaoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.errors });
    }

    const d = parse.data;
    const enteId = request.enteId!;
    const usuarioId = request.session!.id;

    // Buscar motorista_id do usuário logado
    const motRes = await queryTenant(enteId, `
      SELECT id FROM motoristas WHERE usuario_id = $1 LIMIT 1
    `, [usuarioId]);

    if (motRes.rows.length === 0) {
      return reply.status(403).send({ erro: 'Usuário não possui cadastro de motorista ativo' });
    }
    const motoristaId = motRes.rows[0].id;

    // Buscar veículo e dados para instantâneo (D-12)
    const veicRes = await queryTenant(enteId, `
      SELECT v.id, v.secretaria_id, s.unidade_gestora_id
      FROM veiculos v
      JOIN secretarias s ON s.id = v.secretaria_id
      WHERE v.id = $1 AND v.ativo = true
    `, [d.veiculoId]);

    if (veicRes.rows.length === 0) {
      return reply.status(404).send({ erro: 'Veículo não encontrado ou inativo' });
    }
    const veic = veicRes.rows[0];

    // Buscar item de contrato e preço vigente no posto (D-02)
    const precoRes = await queryTenant(enteId, `
      SELECT ci.id as contrato_item_id, cp.preco_unitario, c.id as contrato_id
      FROM postos p
      JOIN contratos c ON c.fornecedor_id = p.fornecedor_id AND c.ativo = true
      JOIN contrato_itens ci ON ci.contrato_id = c.id AND ci.produto = $1
      JOIN contrato_precos cp ON cp.contrato_item_id = ci.id AND cp.vigencia_fim IS NULL
      WHERE p.id = $2
      ORDER BY cp.vigencia_inicio DESC
      LIMIT 1
    `, [d.tipoCombustivel, d.postoId]);

    if (precoRes.rows.length === 0) {
      return reply.status(400).send({ 
        erro: 'Não há contrato/preço vigente para este combustível no posto selecionado' 
      });
    }

    const { contrato_item_id, preco_unitario } = precoRes.rows[0];
    const valorEstimado = Number((Number(preco_unitario) * d.litrosSolicitados).toFixed(2));

    // Gerar código ABT-AAAA-XXXXXX
    const anoAtual = new Date().getFullYear();
    const sufixoAleatorio = Math.random().toString(36).substring(2, 8).toUpperCase();
    const codigoAbt = `ABT-${anoAtual}-${sufixoAleatorio}`;

    const mesAtual = new Date().getMonth() + 1;
    const validadeMinutos = 60; // 1 hora de validade
    const validadeLimite = new Date(Date.now() + validadeMinutos * 60 * 1000);

    // Executa em transação segura:
    // 1. Cria a autorização
    // 2. Chama a função de banco reservar_cota_veiculo (com SELECT FOR UPDATE e trigger imutável)
    const autorizacaoCriada = await withTenant(enteId, async (client) => {
      const autInsert = await client.query(`
        INSERT INTO autorizacoes (
          ente_id, codigo_abt, veiculo_id, motorista_id, posto_id,
          contrato_item_id, tipo_combustivel, litros_solicitados, valor_estimado,
          status, validade_limite, instantaneo_secretaria_id,
          instantaneo_unidade_gestora_id, instantaneo_preco_unitario
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RESERVADA', $10, $11, $12, $13)
        RETURNING id, codigo_abt, status, validade_limite, litros_solicitados, valor_estimado
      `, [
        enteId, codigoAbt, d.veiculoId, motoristaId, d.postoId,
        contrato_item_id, d.tipoCombustivel, d.litrosSolicitados, valorEstimado,
        validadeLimite, veic.secretaria_id, veic.unidade_gestora_id, preco_unitario
      ]);

      const aut = autInsert.rows[0];

      // Invariante D-01: Reserva atômica no banco
      await client.query(`
        SELECT reservar_cota_veiculo($1, $2, $3, $4, $5, $6, $7)
      `, [aut.id, d.veiculoId, d.tipoCombustivel, d.litrosSolicitados, anoAtual, mesAtual, enteId]);

      return aut;
    });

    return reply.status(201).send(autorizacaoCriada);
  });

  // 3. Confirmar Abastecimento pelo Frentista (D-05)
  fastify.post('/confirmar-frentista', {
    preHandler: [requireRoles(['FRENTISTA', 'GESTOR_GERAL'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = ConfirmarFrentistaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.errors });
    }

    const d = parse.data;
    const enteId = request.enteId!;
    const frentistaId = request.session!.id;

    const result = await withTenant(enteId, async (client) => {
      // Busca autorização pelo código ABT
      const autRes = await client.query(`
        SELECT a.id, a.veiculo_id, a.motorista_id, a.posto_id, a.status, 
               a.validade_limite, a.litros_solicitados, a.instantaneo_preco_unitario,
               v.capacidade_tanque_litros
        FROM autorizacoes a
        JOIN veiculos v ON v.id = a.veiculo_id
        WHERE a.codigo_abt = $1
        FOR UPDATE
      `, [d.codigoAbt]);

      if (autRes.rows.length === 0) {
        throw new Error('Código de autorização não encontrado');
      }

      const aut = autRes.rows[0];

      if (aut.status !== 'RESERVADA') {
        throw new Error(`Autorização em status inválido: ${aut.status}`);
      }

      if (new Date() > new Date(aut.validade_limite)) {
        throw new Error('Código de autorização expirado');
      }

      // D-02: Preço praticado nunca acima do contratado
      if (d.precoUnitario > Number(aut.instantaneo_preco_unitario)) {
        throw new Error(`Preço informado (R$ ${d.precoUnitario}) é superior ao preço contratado (R$ ${aut.instantaneo_preco_unitario})`);
      }

      // D-11: Volume abastecido não pode exceder a capacidade do tanque
      if (d.litrosAbastecidos > Number(aut.capacidade_tanque_litros)) {
        throw new Error(`Volume abastecido (${d.litrosAbastecidos} L) excede a capacidade do tanque (${aut.capacidade_tanque_litros} L)`);
      }

      const valorTotal = Number((d.litrosAbastecidos * d.precoUnitario).toFixed(2));

      // Grava abastecimento
      const abastInsert = await client.query(`
        INSERT INTO abastecimentos (
          ente_id, autorizacao_id, veiculo_id, posto_id, motorista_id,
          frentista_usuario_id, litros_abastecidos, preco_unitario_aplicado,
          valor_total, medidor_leitura, foto_painel_url, foto_bomba_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, litros_abastecidos, preco_unitario_aplicado, valor_total, criado_em
      `, [
        enteId, aut.id, aut.veiculo_id, aut.posto_id, aut.motorista_id,
        frentistaId, d.litrosAbastecidos, d.precoUnitario, valorTotal,
        d.medidorLeitura, d.fotoPainelUrl, d.fotoBombaUrl
      ]);

      // Atualiza status da autorização
      await client.query(`
        UPDATE autorizacoes
        SET status = 'CONFIRMADA_FRENTISTA'
        WHERE id = $1
      `, [aut.id]);

      return {
        mensagem: 'Abastecimento registrado pelo frentista. Aguardando confirmação bilateral do motorista.',
        abastecimento: abastInsert.rows[0],
      };
    });

    return reply.send(result);
  });

  // 4. Confirmação Bilateral pelo Motorista (D-05 / D-01)
  fastify.post('/confirmar-motorista', {
    preHandler: [requireRoles(['MOTORISTA', 'GESTOR_GERAL'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = ConfirmarMotoristaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ erro: 'Dados inválidos', detalhes: parse.error.errors });
    }

    const { autorizacaoId, codigoAbt } = parse.data;
    const enteId = request.enteId!;

    const result = await withTenant(enteId, async (client) => {
      const filtroColuna = autorizacaoId ? 'a.id = $1' : 'a.codigo_abt = $1';
      const filtroValor = autorizacaoId || codigoAbt!;

      const autRes = await client.query(`
        SELECT a.id, a.codigo_abt, a.status, ab.id as abastecimento_id, ab.litros_abastecidos
        FROM autorizacoes a
        JOIN abastecimentos ab ON ab.autorizacao_id = a.id
        WHERE ${filtroColuna}
        FOR UPDATE
      `, [filtroValor]);

      if (autRes.rows.length === 0) {
        throw new Error('Abastecimento não encontrado para esta autorização ou código ABT');
      }

      const aut = autRes.rows[0];

      if (aut.status !== 'CONFIRMADA_FRENTISTA') {
        throw new Error(`Status não permite confirmação do motorista: ${aut.status}`);
      }

      // Efetiva o consumo no banco (baixa a reserva e libera sobra se houver)
      await client.query(`
        SELECT consumir_cota_veiculo($1, $2, $3)
      `, [aut.id, aut.litros_abastecidos, enteId]);

      // Atualiza status final bilateral
      await client.query(`
        UPDATE autorizacoes SET status = 'CONFIRMADA_BILATERAL' WHERE id = $1
      `, [aut.id]);

      await client.query(`
        UPDATE abastecimentos SET confirmado_motorista_em = now() WHERE id = $1
      `, [aut.abastecimento_id]);

      return {
        mensagem: 'Abastecimento confirmado bilateralmente com sucesso. Saldo de cotas atualizado.',
        autorizacaoId: aut.id,
        codigoAbt: aut.codigo_abt,
        abastecimentoId: aut.abastecimento_id,
      };
    });

    return reply.send(result);
  });

  // 4.1 Listar Abastecimentos Pendentes de Confirmação Bilateral pelo Motorista
  fastify.get('/pendentes-motorista', {
    preHandler: [requireRoles(['MOTORISTA', 'GESTOR_GERAL'])]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const enteId = request.enteId!;
    const usuarioId = request.session!.id;
    const papel = request.session!.perfilAtivo.papel;

    const motRes = await queryTenant(enteId, `
      SELECT id FROM motoristas WHERE usuario_id = $1 LIMIT 1
    `, [usuarioId]);

    if (motRes.rows.length === 0 && papel !== 'GESTOR_GERAL') {
      return reply.send([]);
    }

    const motoristaId = motRes.rows[0]?.id || null;
    const params: any[] = [];
    let filtroMotorista = '';
    if (motoristaId) {
      params.push(motoristaId);
      filtroMotorista = 'AND a.motorista_id = $1';
    }

    const res = await queryTenant(enteId, `
      SELECT a.id as autorizacao_id, a.codigo_abt, a.status, a.tipo_combustivel,
             a.litros_solicitados, a.criado_em as autorizado_em,
             v.placa, v.marca_modelo, v.tipo_medidor,
             p.nome as posto_nome,
             ab.id as abastecimento_id, ab.litros_abastecidos,
             ab.preco_unitario_aplicado, ab.valor_total,
             ab.medidor_leitura, ab.criado_em as abastecido_em
      FROM autorizacoes a
      JOIN abastecimentos ab ON ab.autorizacao_id = a.id
      JOIN veiculos v ON v.id = a.veiculo_id
      JOIN postos p ON p.id = a.posto_id
      WHERE a.status = 'CONFIRMADA_FRENTISTA'
      ${filtroMotorista}
      ORDER BY ab.criado_em DESC
    `, params);

    return reply.send(res.rows);
  });

  // 5. Consultar Autorização por Código ABT (Frentista / Motorista)
  fastify.get<{ Params: { codigoAbt: string } }>('/autorizacao/:codigoAbt', {
    preHandler: [requireRoles(['FRENTISTA', 'MOTORISTA', 'GESTOR_GERAL', 'ADMIN_GERAL', 'GESTOR_SECRETARIA'])]
  }, async (request, reply) => {
    const enteId = request.enteId!;
    const codigoAbt = request.params.codigoAbt.toUpperCase().trim();

    const res = await queryTenant(enteId, `
      SELECT a.id, a.codigo_abt, a.status, a.validade_limite, a.litros_solicitados,
             a.tipo_combustivel, a.instantaneo_preco_unitario, a.valor_estimado,
             v.id as veiculo_id, v.placa, v.marca_modelo, v.capacidade_tanque_litros,
             v.tipo_medidor,
             p.nome as posto_nome,
             u.nome as motorista_nome
      FROM autorizacoes a
      JOIN veiculos v ON v.id = a.veiculo_id
      JOIN postos p ON p.id = a.posto_id
      JOIN motoristas m ON m.id = a.motorista_id
      JOIN usuarios u ON u.id = m.usuario_id
      WHERE a.codigo_abt = $1
      LIMIT 1
    `, [codigoAbt]);

    if (res.rows.length === 0) {
      return reply.status(404).send({ erro: 'Código de autorização não encontrado' });
    }

    return reply.send(res.rows[0]);
  });
}

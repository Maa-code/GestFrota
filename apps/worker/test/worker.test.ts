process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { pool, withTenant } from '../dist/db.js';
import { executarExpiracaoAutorizacoes } from '../dist/jobs/expirarAutorizacoes.js';
import { executarRenovacaoCotasMensais } from '../dist/jobs/renovarCotasMensais.js';
import { executarGeracaoAncorasAuditoria } from '../dist/jobs/gerarAncorasAuditoria.js';
import { executarProcessamentoOutbox } from '../dist/jobs/processarOutbox.js';

describe('GestFrota Worker - Rotinas Assíncronas e Invariantes', () => {
  const enteId = '11111111-1111-1111-1111-111111111111';
  const veiculoId = '66666666-6666-6666-6666-666666666666';
  const motoristaId = '55555555-5555-5555-5555-555555555555';
  const postoId = '88888888-8888-8888-8888-888888888888';
  const itemId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const secId = '33333333-3333-3333-3333-333333333333';
  const ugId = '22222222-2222-2222-2222-222222222222';

  before(async () => {
    // Limpa autorizações pendentes de testes anteriores e garante saldo no veículo
    await pool.query(`UPDATE autorizacoes SET status = 'EXPIRADA' WHERE status = 'RESERVADA'`);
    const ano = new Date().getFullYear();
    const mes = new Date().getMonth() + 1;
    await pool.query(`
      UPDATE cotas_veiculo
      SET saldo_disponivel_litros = 500.0, saldo_reservado_litros = 0.0
      WHERE veiculo_id = $1 AND competencia_ano = $2 AND competencia_mes = $3
    `, [veiculoId, ano, mes]);
  });

  after(async () => {
    await pool.end();
  });

  it('1. Deve expirar autorização vencida e devolver reserva para saldo disponível (D-01 / D-05)', async () => {
    let autId: string;
    const codigoAbt = 'ABT-2026-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1.1 Criar uma autorização já vencida no banco com cota reservada
    await withTenant(enteId, async (client) => {
      const autRes = await client.query(`
        INSERT INTO autorizacoes (
          ente_id, codigo_abt, veiculo_id, motorista_id, posto_id,
          contrato_item_id, tipo_combustivel, litros_solicitados, valor_estimado,
          status, validade_limite, instantaneo_secretaria_id,
          instantaneo_unidade_gestora_id, instantaneo_preco_unitario
        ) VALUES (
          $1, $8, $2, $3, $4,
          $5, 'DIESEL_S10', 30.0, 176.70,
          'RESERVADA', now() - interval '10 minutes', $6, $7, 5.8900
        ) RETURNING id
      `, [enteId, veiculoId, motoristaId, postoId, itemId, secId, ugId, codigoAbt]);
      autId = autRes.rows[0].id;

      // Executa reserva no banco
      const ano = new Date().getFullYear();
      const mes = new Date().getMonth() + 1;
      await client.query(`
        SELECT reservar_cota_veiculo($1, $2, 'DIESEL_S10', 30.0, $3, $4, $5)
      `, [autId, veiculoId, ano, mes, enteId]);
    });

    // Confere que reservou 30 L
    const ano = new Date().getFullYear();
    const mes = new Date().getMonth() + 1;
    const cotaAntes = await pool.query(`
      SELECT saldo_disponivel_litros, saldo_reservado_litros
      FROM cotas_veiculo 
      WHERE veiculo_id = $1 AND competencia_ano = $2 AND competencia_mes = $3
    `, [veiculoId, ano, mes]);
    assert.strictEqual(Number(cotaAntes.rows[0].saldo_reservado_litros), 30.0);

    // 1.2 Executa o job de expiração do Worker
    const resultado = await executarExpiracaoAutorizacoes();
    assert.ok(resultado.expiradas >= 1);
    assert.ok(resultado.autorizacoes.includes(autId!));

    // 1.3 Verifica se a autorização ficou EXPIRADA
    const autCheck = await pool.query(`
      SELECT status FROM autorizacoes WHERE id = $1
    `, [autId!]);
    assert.strictEqual(autCheck.rows[0].status, 'EXPIRADA');

    // 1.4 Verifica se a cota reservada zerou e voltou para disponível
    const cotaDepois = await pool.query(`
      SELECT saldo_disponivel_litros, saldo_reservado_litros
      FROM cotas_veiculo 
      WHERE veiculo_id = $1 AND competencia_ano = $2 AND competencia_mes = $3
    `, [veiculoId, ano, mes]);
    assert.strictEqual(Number(cotaDepois.rows[0].saldo_reservado_litros), 0.0);
    assert.strictEqual(Number(cotaDepois.rows[0].saldo_disponivel_litros), 500.0);

    // 1.5 Confere evento no Outbox
    const outboxCheck = await pool.query(`
      SELECT id, status, topico FROM outbox WHERE topico = 'AUTORIZACAO_EXPIRADA' ORDER BY criado_em DESC LIMIT 1
    `);
    assert.strictEqual(outboxCheck.rows.length, 1);
    assert.strictEqual(outboxCheck.rows[0].status, 'PENDENTE');
  });

  it('2. Deve renovar cotas mensais de forma idempotente (D-23 / D-24)', async () => {
    // Usa uma competência futura única para cada execução
    const anoFuturo = 2030 + Math.floor(Math.random() * 50);

    // 2.1 Primeira execução para competência futura
    const res1 = await executarRenovacaoCotasMensais(anoFuturo, 1);
    assert.ok(res1.cotasCriadas >= 1, 'Deve ter criado cota para o veículo');

    // Confere cota criada
    const cotaFutura = await pool.query(`
      SELECT limite_litros, saldo_disponivel_litros, saldo_reservado_litros
      FROM cotas_veiculo
      WHERE veiculo_id = $1 AND competencia_ano = $2 AND competencia_mes = 1
    `, [veiculoId, anoFuturo]);
    assert.strictEqual(cotaFutura.rows.length, 1);
    assert.strictEqual(Number(cotaFutura.rows[0].limite_litros), 500.0);

    // 2.2 Segunda execução imediata para a MESMA competência (deve ser idempotente)
    const res2 = await executarRenovacaoCotasMensais(anoFuturo, 1);
    assert.strictEqual(res2.cotasCriadas, 0, 'Não pode duplicar ou recriar cotas existentes');
  });

  it('3. Deve gerar âncora diária selando a auditoria com SHA-256', async () => {
    const dataTeste = '2026-05-18';
    await pool.query(`DELETE FROM auditoria_ancoras WHERE ente_id = $1 AND data_ancora = $2`, [enteId, dataTeste]);

    // Inserir evento na data de teste
    await pool.query(`
      INSERT INTO auditoria (ente_id, entidade, acao, dados_novos, criado_em, hash_anterior, hash_atual)
      VALUES ($1, 'veiculos', 'TESTE_ANCORA', '{"placa": "TESTE"}'::jsonb, $2::date + interval '2 hours', '', '')
    `, [enteId, dataTeste]);

    // Executar job de ancoragem
    const res = await executarGeracaoAncorasAuditoria(dataTeste);
    assert.ok(res.ancorasCriadas >= 1);

    // Verificar no banco
    const ancoraCheck = await pool.query(`
      SELECT total_eventos, hash_raiz_sha256
      FROM auditoria_ancoras
      WHERE ente_id = $1 AND data_ancora = $2
    `, [enteId, dataTeste]);

    assert.strictEqual(ancoraCheck.rows.length, 1);
    assert.ok(ancoraCheck.rows[0].total_eventos >= 1);
    assert.strictEqual(ancoraCheck.rows[0].hash_raiz_sha256.length, 64);
  });

  it('4. Deve processar eventos pendentes do Outbox transacional', async () => {
    // Executa processamento do outbox
    const res = await executarProcessamentoOutbox();
    assert.ok(res.processados >= 1, 'Deve processar ao menos a notificação de expiração');

    // Confere se foram marcados como PROCESSADO
    const pendentes = await pool.query(`
      SELECT COUNT(*) as count FROM outbox WHERE status = 'PENDENTE'
    `);
    assert.strictEqual(Number(pendentes.rows[0].count), 0);
  });
});

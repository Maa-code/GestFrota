process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../dist/index.js';
import { pool } from '../dist/db/index.js';

describe('GestFrota API - Ciclo Completo de Abastecimento e RLS', () => {
  const app = buildApp();

  before(async () => {
    await pool.query(`
      UPDATE cotas_veiculo
      SET saldo_disponivel_litros = 500.0, saldo_reservado_litros = 0.0
      WHERE veiculo_id = '66666666-6666-6666-6666-666666666666'
    `);
  });

  after(async () => {
    await app.close();
    await pool.end();
  });

  let motoristaCookie: string;
  let frentistaCookie: string;
  let veiculoId: string;
  let postoId: string;
  let codigoAbt: string;
  let autorizacaoId: string;

  it('1. Deve responder com sucesso ao healthcheck', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'ok');
  });

  it('2. Deve autenticar motorista e receber cookie HttpOnly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'carlos.motorista@gestfrota.gov.br',
        senha: 'senha-segura-123',
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.usuario.perfilAtivo.papel, 'MOTORISTA');

    // Extrair cookie
    const cookieHeader = res.headers['set-cookie'];
    assert.ok(cookieHeader);
    motoristaCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  });

  it('3. Deve listar veículos do ente ativo com contexto RLS', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/frota/veiculos',
      headers: {
        cookie: motoristaCookie,
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const veiculos = JSON.parse(res.body);
    assert.ok(veiculos.length > 0);
    const v = veiculos.find((item: any) => item.placa === 'BRA2E19');
    assert.ok(v, 'Veículo BRA2E19 deve existir');
    veiculoId = v.id;
  });

  it('4. Deve listar postos credenciados', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fornecimento/postos',
      headers: {
        cookie: motoristaCookie,
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const postos = JSON.parse(res.body);
    assert.ok(postos.length > 0);
    postoId = postos[0].id;
  });

  it('5. Motorista solicita autorização de abastecimento com reserva de cota (D-05 / D-01)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cotas/solicitar-abastecimento',
      headers: {
        cookie: motoristaCookie,
      },
      payload: {
        veiculoId,
        postoId,
        tipoCombustivel: 'DIESEL_S10',
        litrosSolicitados: 50.0,
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.codigo_abt.startsWith('ABT-'));
    assert.strictEqual(body.status, 'RESERVADA');

    codigoAbt = body.codigo_abt;
    autorizacaoId = body.id;
  });

  it('6. Deve autenticar frentista', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'joao.posto@gestfrota.gov.br',
        senha: 'senha-segura-123',
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const cookieHeader = res.headers['set-cookie'];
    assert.ok(cookieHeader);
    frentistaCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  });

  it('7. Frentista registra o abastecimento no posto', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cotas/confirmar-frentista',
      headers: {
        cookie: frentistaCookie,
      },
      payload: {
        codigoAbt,
        litrosAbastecidos: 45.0, // Abasteceu 45 dos 50 reservados (sobra 5 L)
        precoUnitario: 5.8900,
        medidorLeitura: 12500,
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.abastecimento);
    assert.strictEqual(body.abastecimento.litros_abastecidos, '45.000');
  });

  it('8. Motorista lista pendências e realiza confirmação bilateral com código ABT (D-05 / D-06)', async () => {
    const pendentesRes = await app.inject({
      method: 'GET',
      url: '/api/cotas/pendentes-motorista',
      headers: {
        cookie: motoristaCookie,
      },
    });
    assert.strictEqual(pendentesRes.statusCode, 200);
    const pendentes = JSON.parse(pendentesRes.body);
    assert.ok(pendentes.some((p: any) => p.codigo_abt === codigoAbt && p.autorizacao_id === autorizacaoId));

    const res = await app.inject({
      method: 'POST',
      url: '/api/cotas/confirmar-motorista',
      headers: {
        cookie: motoristaCookie,
      },
      payload: {
        codigoAbt,
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.autorizacaoId, autorizacaoId);
    assert.strictEqual(body.codigoAbt, codigoAbt);
  });

  it('9. Extrato do veículo reflete consumo real e liberação da sobra no razão imutável (D-01)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/cotas/veiculo/${veiculoId}`,
      headers: {
        cookie: motoristaCookie,
      },
    });

    if (res.statusCode !== 200) {
      console.log('ERRO LOGIN:', res.statusCode, res.body);
    }
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;
    const cota = body.cotas.find((c: any) => c.competencia_ano === anoAtual && c.competencia_mes === mesAtual);
    assert.ok(cota, 'Cota da competência atual deve existir');

    // O saldo inicial era 500 L. Reservou 50, consumiu 45, devolveu 5. Saldo final = 455 L.
    assert.strictEqual(Number(cota.saldo_disponivel_litros), 455.0);
    assert.strictEqual(Number(cota.saldo_reservado_litros), 0.0);

    // Movimentos de cota registrados
    const tipos = body.movimentos.map((m: any) => m.tipo);
    assert.ok(tipos.includes('RESERVA'), 'Deve conter movimento de RESERVA');
    assert.ok(tipos.includes('CONSUMO'), 'Deve conter movimento de CONSUMO');
    assert.ok(tipos.includes('LIBERACAO'), 'Deve conter movimento de LIBERACAO');
  });
});

import { query, withTenant } from '../db.js';

export interface ResultadoRenovacao {
  ano: number;
  mes: number;
  cotasCriadas: number;
}

/**
 * D-23 / D-24: Rotina mensal idempotente de abertura de competência e renovação de cotas.
 * Renova a cota ordinária dos veículos ativos para o mês/ano informado,
 * respeitando a política de acúmulo do ente (padrão 'NAO_ACUMULA').
 */
export async function executarRenovacaoCotasMensais(
  anoAlvo?: number,
  mesAlvo?: number
): Promise<ResultadoRenovacao> {
  const agora = new Date();
  const ano = anoAlvo || agora.getFullYear();
  const mes = mesAlvo || agora.getMonth() + 1;

  // Competência anterior (mês anterior)
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;

  // Busca entes ativos
  const entesRes = await query(`SELECT id FROM entes WHERE ativo = true`);
  let totalCriadas = 0;

  for (const ente of entesRes.rows) {
    const enteId = ente.id;

    await withTenant(enteId, async (client) => {
      // Busca política do ente
      const paramRes = await client.query(`
        SELECT politica_acumulo_cota FROM parametros_ente WHERE ente_id = $1
      `, [enteId]);
      const acumula = paramRes.rows[0]?.politica_acumulo_cota === 'ACUMULA';

      // Busca a última cota ordinária de referência de cada veículo ativo
      // que AINDA NÃO possui cota cadastrada no mês alvo (Idempotência D-23 / D-24)
      const cotasAnteriores = await client.query(`
        SELECT DISTINCT ON (cv.veiculo_id, cv.tipo_combustivel)
          cv.veiculo_id, cv.tipo_combustivel, cv.limite_litros, cv.saldo_disponivel_litros
        FROM cotas_veiculo cv
        JOIN veiculos v ON v.id = cv.veiculo_id AND v.ativo = true
        WHERE cv.ente_id = $1
          AND cv.origem = 'ORDINARIA'
          AND NOT EXISTS (
            SELECT 1 FROM cotas_veiculo atual
            WHERE atual.veiculo_id = cv.veiculo_id
              AND atual.competencia_ano = $2
              AND atual.competencia_mes = $3
              AND atual.tipo_combustivel = cv.tipo_combustivel
              AND atual.origem = 'ORDINARIA'
          )
        ORDER BY cv.veiculo_id, cv.tipo_combustivel, cv.competencia_ano DESC, cv.competencia_mes DESC
      `, [enteId, ano, mes]);

      for (const row of cotasAnteriores.rows) {
        const limite = Number(row.limite_litros);
        const saldoAnterior = Number(row.saldo_disponivel_litros);
        const saldoInicial = acumula ? saldoAnterior + limite : limite;

        const insertRes = await client.query(`
          INSERT INTO cotas_veiculo (
            ente_id, veiculo_id, competencia_ano, competencia_mes,
            tipo_combustivel, origem, limite_litros, saldo_disponivel_litros, saldo_reservado_litros
          ) VALUES ($1, $2, $3, $4, $5, 'ORDINARIA', $6, $7, 0.0)
          RETURNING id
        `, [
          enteId, row.veiculo_id, ano, mes,
          row.tipo_combustivel, limite, saldoInicial
        ]);

        const novaCotaId = insertRes.rows[0].id;

        // Registra razão imutável
        await client.query(`
          INSERT INTO movimentos_cota (
            ente_id, cota_veiculo_id, tipo, litros, saldo_anterior, saldo_posterior, justificativa
          ) VALUES ($1, $2, 'AJUSTE', $3, 0.0, $3, $4)
        `, [
          enteId, novaCotaId, saldoInicial,
          `Abertura automática de competência ${mes}/${ano} (Política: ${acumula ? 'Acúmulo' : 'Sem Acúmulo'})`
        ]);

        totalCriadas++;
      }
    });
  }

  return {
    ano,
    mes,
    cotasCriadas: totalCriadas,
  };
}

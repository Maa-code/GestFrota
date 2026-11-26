import React, { useEffect, useState, useCallback } from 'react';
import { Fuel, History, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function Cotas() {
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [veiculoSelecionadoId, setVeiculoSelecionadoId] = useState<string>('');
  const [extrato, setExtrato] = useState<{ cotas: any[]; movimentos: any[] } | null>(null);
  const [abastecimentos, setAbastecimentos] = useState<any[]>([]);
  const [erroAbastecimentos, setErroAbastecimentos] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    async function carregarVeiculos() {
      const veics = await apiFetch<any[]>('/api/frota/veiculos').catch(() => []);
      setVeiculos(veics);
      if (veics.length > 0) {
        setVeiculoSelecionadoId(veics[0].id);
      }
    }
    carregarVeiculos();
  }, []);

  const carregarDados = useCallback(async () => {
    if (!veiculoSelecionadoId) return;
    setCarregando(true);
    setErroAbastecimentos(null);
    try {
      const [dadosExtrato, dadosAbastecimentos] = await Promise.all([
        apiFetch<any>(`/api/cotas/veiculo/${veiculoSelecionadoId}`),
        apiFetch<any[]>(`/api/cotas/abastecimentos?veiculoId=${veiculoSelecionadoId}`).catch((err: any) => {
          setErroAbastecimentos(err?.message || 'Erro ao carregar histórico de abastecimentos');
          return [];
        }),
      ]);
      setExtrato(dadosExtrato);
      setAbastecimentos(dadosAbastecimentos);
    } finally {
      setCarregando(false);
    }
  }, [veiculoSelecionadoId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  const cotaAtual =
    extrato?.cotas.find(
      (c) => Number(c.competencia_ano) === anoAtual && Number(c.competencia_mes) === mesAtual
    ) || extrato?.cotas[0];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Seletor de Veículo */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Cotas &amp; Abastecimentos (Razão D-01)</h3>
          <p className="text-xs text-slate-500">
            Acompanhe o saldo disponível, histórico de abastecimentos na pista e movimentações auditáveis
          </p>
        </div>

        <div className="flex items-end gap-2 w-full sm:w-auto">
          <div className="w-full sm:w-72">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Selecione o Veículo:</label>
            <select
              value={veiculoSelecionadoId}
              onChange={(e) => setVeiculoSelecionadoId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:ring-2 focus:ring-brand-500/20"
            >
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.marca_modelo} ({v.secretaria_sigla})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={carregarDados}
            disabled={carregando}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Cards de Saldo do Veículo Selecionado */}
      {cotaAtual && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Limite Mensal da Cota
            </span>
            <p className="text-3xl font-bold text-slate-900">
              {Number(cotaAtual.limite_litros).toFixed(1)} L
            </p>
            <p className="text-xs text-slate-400">
              Competência {cotaAtual.competencia_mes}/{cotaAtual.competencia_ano} ({cotaAtual.tipo_combustivel})
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Saldo Disponível para Uso
            </span>
            <p className="text-3xl font-bold text-emerald-600">
              {Number(cotaAtual.saldo_disponivel_litros).toFixed(1)} L
            </p>
            <p className="text-xs text-slate-400">Restrição CHECK (saldo &gt;= 0) garantida no banco</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Saldo Reservado em Autorizações
            </span>
            <p className="text-3xl font-bold text-amber-600">
              {Number(cotaAtual.saldo_reservado_litros).toFixed(1)} L
            </p>
            <p className="text-xs text-slate-400">Códigos ABT ativos aguardando abastecimento</p>
          </div>
        </div>
      )}

      {/* Histórico de Abastecimentos Realizados */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-3 p-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Fuel className="w-5 h-5 text-brand-600" />
          <h4 className="font-bold text-slate-900 text-sm">Histórico de Abastecimentos Realizados</h4>
        </div>

        {erroAbastecimentos && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {erroAbastecimentos}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Código ABT</th>
                <th className="px-4 py-3">Posto / Motorista</th>
                <th className="px-4 py-3">Volume / Preço</th>
                <th className="px-4 py-3">Valor Total</th>
                <th className="px-4 py-3">Medidor</th>
                <th className="px-4 py-3">Confirmação Bilateral</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">Carregando abastecimentos...</td>
                </tr>
              ) : abastecimentos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">Nenhum abastecimento registrado para este veículo.</td>
                </tr>
              ) : (
                abastecimentos.map((ab) => {
                  const bilateralOk = ab.status_autorizacao === 'CONFIRMADA_BILATERAL';
                  return (
                    <tr key={ab.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(ab.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {ab.codigo_abt}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{ab.posto_nome}</div>
                        <div className="text-[11px] text-slate-500">
                          Mot: {ab.motorista_nome} · Frent: {ab.frentista_nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {Number(ab.litros_abastecidos).toFixed(2)} L
                        </div>
                        <div className="text-[11px] text-slate-500">
                          R$ {Number(ab.preco_unitario_aplicado).toFixed(3)} / L
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">
                        R$ {Number(ab.valor_total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        {Number(ab.medidor_leitura)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {bilateralOk ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmada Bilateral
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" />
                            Aguardando Motorista
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extrato do Razão Imutável de Movimentos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-3 p-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <History className="w-5 h-5 text-slate-600" />
          <h4 className="font-bold text-slate-900 text-sm">Extrato Imutável de Movimentações</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Data/Hora</th>
                <th className="px-4 py-3">Tipo de Operação</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Saldo Anterior</th>
                <th className="px-4 py-3">Saldo Posterior</th>
                <th className="px-4 py-3">Justificativa / Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">Carregando extrato...</td>
                </tr>
              ) : !extrato || extrato.movimentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">Nenhum movimento registrado.</td>
                </tr>
              ) : (
                extrato.movimentos.map((m) => {
                  let badge = 'bg-slate-100 text-slate-700';
                  if (m.tipo === 'RESERVA') badge = 'bg-amber-100 text-amber-800';
                  if (m.tipo === 'CONSUMO') badge = 'bg-blue-100 text-blue-800';
                  if (m.tipo === 'LIBERACAO') badge = 'bg-emerald-100 text-emerald-800';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(m.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${badge}`}>
                          {m.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {Number(m.litros).toFixed(2)} L
                      </td>
                      <td className="px-4 py-3 text-slate-600">{Number(m.saldo_anterior).toFixed(2)} L</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{Number(m.saldo_posterior).toFixed(2)} L</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-xs">{m.justificativa}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Fuel, ArrowDownRight, ArrowUpRight, History, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function Cotas() {
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [veiculoSelecionadoId, setVeiculoSelecionadoId] = useState<string>('');
  const [extrato, setExtrato] = useState<{ cotas: any[]; movimentos: any[] } | null>(null);
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

  useEffect(() => {
    if (!veiculoSelecionadoId) return;
    async function carregarExtrato() {
      setCarregando(true);
      try {
        const dados = await apiFetch<any>(`/api/cotas/veiculo/${veiculoSelecionadoId}`);
        setExtrato(dados);
      } finally {
        setCarregando(false);
      }
    }
    carregarExtrato();
  }, [veiculoSelecionadoId]);

  const cotaAtual = extrato?.cotas[0];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Seletor de Veículo */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Razão de Cotas Imutável (D-01)</h3>
          <p className="text-xs text-slate-500">
            Acompanhe o saldo disponível, reserva atômica e extrato de movimentações auditáveis
          </p>
        </div>

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

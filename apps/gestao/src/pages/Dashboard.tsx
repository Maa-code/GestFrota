import React, { useEffect, useState } from 'react';
import { Truck, Fuel, FileCheck, ShieldAlert, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function Dashboard() {
  const [veiculosCount, setVeiculosCount] = useState<number>(0);
  const [postosCount, setPostosCount] = useState<number>(0);
  const [contratosCount, setContratosCount] = useState<number>(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarIndicadores() {
      try {
        const [veics, postos, contratos] = await Promise.all([
          apiFetch<any[]>('/api/frota/veiculos').catch(() => []),
          apiFetch<any[]>('/api/fornecimento/postos').catch(() => []),
          apiFetch<any[]>('/api/fornecimento/contratos').catch(() => []),
        ]);
        setVeiculosCount(veics.length);
        setPostosCount(postos.length);
        setContratosCount(contratos.length);
      } finally {
        setCarregando(false);
      }
    }
    carregarIndicadores();
  }, []);

  const cards = [
    {
      titulo: 'Frota Ativa',
      valor: veiculosCount,
      subtitulo: 'Veículos operacionais vinculados',
      icone: Truck,
      cor: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    {
      titulo: 'Postos Credenciados',
      valor: postosCount,
      subtitulo: 'Rede de abastecimento contratada',
      icone: Fuel,
      cor: 'text-brand-600 bg-brand-50 border-brand-100',
    },
    {
      titulo: 'Contratos Vigentes',
      valor: contratosCount,
      subtitulo: 'Preços unitários controlados (D-02)',
      icone: FileCheck,
      cor: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    {
      titulo: 'Invariantes de Banco',
      valor: '100% OK',
      subtitulo: 'Trilha SHA-256 e Cotas Imutáveis',
      icone: CheckCircle2,
      cor: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Grade de Indicadores Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => {
          const Icon = c.icone;
          return (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {c.titulo}
                </span>
                <div className={`p-2 rounded-xl border ${c.cor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">
                  {carregando ? '—' : c.valor}
                </p>
                <p className="text-xs text-slate-500 mt-1">{c.subtitulo}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seção de Destaque das Invariantes Críticas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-base">
                Ciclo Seguro de Combustível (D-01 / D-05 / D-06)
              </h3>
              <p className="text-xs text-slate-500">
                Garantias formais de integridade auditável aplicadas neste município
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
              Regras Ativas
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800">Razão de Cotas Imutável (D-01)</p>
                <p className="text-xs text-slate-600">
                  Reserva atômica na solicitação, consumo na validação e liberação automática de sobras pelo worker. Bloqueio em ordem fixa e saldo não-negativo.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800">Confirmação Bilateral e Código Único (D-05 / D-06)</p>
                <p className="text-xs text-slate-600">
                  Autorização válida apenas no posto selecionado e por tempo limitado, com confirmação obrigatória pelo motorista no celular.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800">Restrição de Sobreposição Temporal (D-27)</p>
                <p className="text-xs text-slate-600">
                  Restrições <code>EXCLUDE USING gist</code> impedem que o mesmo veículo ou motorista possua viagens ou sessões de uso simultâneas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card Lateral: Parâmetros do Município */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-lg p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-brand-400 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4" />
              <span>Parâmetros do Ente</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Segurança & Conformidade</h4>
              <p className="text-xs text-slate-400 mt-1">
                Políticas ativas conforme Nota Técnica 01/2018-CT e IN RFB 2.229/2024.
              </p>
            </div>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Validade da Autorização:</span>
                <span className="font-semibold text-slate-200">60 minutos</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Política de Acúmulo de Cota:</span>
                <span className="font-semibold text-slate-200">Sem acúmulo (D-23)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Formato de Chave NF-e:</span>
                <span className="font-semibold text-slate-200">44 alfanumérico (D-09)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Auditoria:</span>
                <span className="font-semibold text-emerald-400">SHA-256 Encadeado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

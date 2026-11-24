import React, { useEffect, useState } from 'react';
import { FileText, Fuel, Building, DollarSign } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function Contratos() {
  const [contratos, setContratos] = useState<any[]>([]);
  const [postos, setPostos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [c, p] = await Promise.all([
          apiFetch<any[]>('/api/fornecimento/contratos'),
          apiFetch<any[]>('/api/fornecimento/postos'),
        ]);
        setContratos(c);
        setPostos(p);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Contratos Licitados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Contratos de Fornecimento (D-02)</h3>
            <p className="text-xs text-slate-500">
              Contratos licitados com controle rígido de preço unitário e histórico de apostilamento
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {contratos.map((c) => (
            <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200">
                    Contrato nº {c.numero_contrato}/{c.ano}
                  </span>
                  <h4 className="font-bold text-slate-900 text-base mt-2">{c.fornecedor_nome}</h4>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Preço Contratado Vigente</p>
                  <p className="text-xl font-bold text-emerald-600">
                    R$ {Number(c.preco_vigente).toFixed(4)} / L
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Produto Licitado:</span>
                  <span className="font-semibold text-slate-800">{c.produto}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Qtd. Licitada:</span>
                  <span className="font-semibold text-slate-800">
                    {Number(c.quantidade_licitada).toLocaleString('pt-BR')} L
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Vigência:</span>
                  <span className="font-medium text-slate-700">
                    {new Date(c.data_inicio).toLocaleDateString('pt-BR')} a {new Date(c.data_fim).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Valor Global:</span>
                  <span className="font-semibold text-slate-800">
                    R$ {Number(c.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Postos Credenciados */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Rede de Postos Credenciados</h3>
          <p className="text-xs text-slate-500">
            Locais físicos habilitados para validação de códigos ABT e abastecimento presencial
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Nome do Posto</th>
                <th className="px-6 py-4">CNPJ</th>
                <th className="px-6 py-4">Endereço</th>
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {postos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{p.nome}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{p.cnpj}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">{p.endereco}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-700">{p.fornecedor_nome}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Habilitado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Users, Search, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function Motoristas() {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const dados = await apiFetch<any[]>('/api/frota/motoristas');
        setMotoristas(dados);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const motoristasFiltrados = motoristas.filter((m) =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    m.numero_cnh.includes(busca)
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CNH..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
            <tr>
              <th className="px-6 py-4">Nome & Contato</th>
              <th className="px-6 py-4">CPF</th>
              <th className="px-6 py-4">Número CNH</th>
              <th className="px-6 py-4">Categoria</th>
              <th className="px-6 py-4">Validade CNH (D-29)</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carregando ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  Carregando condutores...
                </td>
              </tr>
            ) : motoristasFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  Nenhum condutor encontrado.
                </td>
              </tr>
            ) : (
              motoristasFiltrados.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{m.nome}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{m.cpf}</td>
                  <td className="px-6 py-4 font-mono font-medium text-slate-800">{m.numero_cnh}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {m.categoria_cnh}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-700">
                    {new Date(m.cnh_validade).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    {m.bloqueado ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Apto
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

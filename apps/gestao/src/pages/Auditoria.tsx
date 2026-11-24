import React, { useEffect, useState } from 'react';
import { ShieldCheck, Hash, Calendar, CheckCircle2, Lock } from 'lucide-react';
import { apiFetch } from '../lib/api';

export function Auditoria() {
  const [eventos, setEventos] = useState<any[]>([]);
  const [ancoras, setAncoras] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarAuditoria() {
      try {
        const dados = await apiFetch<any>('/api/auditoria').catch(() => ({ eventos: [], ancoras: [] }));
        setEventos(dados.eventos || []);
        setAncoras(dados.ancoras || []);
      } finally {
        setCarregando(false);
      }
    }
    carregarAuditoria();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-brand-600 font-semibold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>Trilha Criptográfica Encadeada (SHA-256)</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900">
          Auditoria Encadeada e Âncoras Diárias
        </h3>
        <p className="text-xs text-slate-500 max-w-3xl">
          Cada operação gravada no banco incorpora o hash criptográfico do evento anterior, tornando qualquer tentativa de adulteração ou exclusão matematicamente detectável.
        </p>
      </div>

      {/* Âncoras Diárias */}
      <div className="space-y-4">
        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          Âncoras Diárias de Fechamento (Seção 5.3)
        </h4>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Data da Âncora</th>
                <th className="px-6 py-4">Total de Eventos</th>
                <th className="px-6 py-4">IDs Consolidados</th>
                <th className="px-6 py-4">Hash Raiz SHA-256 (Merkle Root)</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {carregando ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Carregando âncoras...</td></tr>
              ) : ancoras.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Nenhuma âncora gerada ainda.</td></tr>
              ) : (
                ancoras.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {new Date(a.data_ancora).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">{a.total_eventos} eventos</td>
                    <td className="px-6 py-4 text-slate-500 font-mono">#{a.primeiro_id} até #{a.ultimo_id}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-emerald-700 truncate max-w-xs">
                      {a.hash_raiz_sha256}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Lock className="w-3 h-3" /> Selada
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trilha de Eventos Encadeados Recentes */}
      <div className="space-y-4">
        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Hash className="w-4 h-4 text-slate-500" />
          Eventos de Auditoria Recentes
        </h4>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">ID / Data</th>
                <th className="px-6 py-4">Entidade</th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4">Hash Anterior</th>
                <th className="px-6 py-4">Hash Atual (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {carregando ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Carregando eventos...</td></tr>
              ) : eventos.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-slate-400">Nenhum evento registrado.</td></tr>
              ) : (
                eventos.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-mono font-bold text-slate-900">#{e.id}</p>
                      <p className="text-[10px] text-slate-400">{new Date(e.criado_em).toLocaleString('pt-BR')}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{e.entidade}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {e.acao}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400 truncate max-w-xs">{e.hash_anterior}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-brand-700 truncate max-w-xs">{e.hash_atual}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

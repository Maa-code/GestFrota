import React from 'react';
import { UserCheck, Shield, AlertTriangle, Building2, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function CredencialFuncional() {
  const { usuario } = useAuth();

  return (
    <div className="space-y-5 pb-6">
      {/* Credencial Funcional Municipal (D-31) */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Marca d'água / Brasão decorativo */}
        <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-brand-500/5 rounded-full blur-2xl pointer-events-none"></div>

        {/* Cabeçalho da Credencial */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold shadow-md shadow-brand-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {usuario?.perfilAtivo.enteNome || 'Prefeitura Municipal'}
              </h2>
              <p className="text-[11px] text-brand-400 font-semibold">Credencial Funcional de Condutor</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Ativo
          </span>
        </div>

        {/* Foto / Identidade do Condutor */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-brand-500/40 flex items-center justify-center text-slate-400">
            <UserCheck className="w-8 h-8 text-brand-400" />
          </div>
          <div className="space-y-0.5">
            <h3 className="font-bold text-base text-white">{usuario?.nome}</h3>
            <p className="text-xs font-mono text-slate-400">CPF: {usuario?.cpf}</p>
            <p className="text-xs text-slate-400">Perfil: <span className="text-slate-200 font-semibold">{usuario?.perfilAtivo.papel}</span></p>
          </div>
        </div>

        {/* Dados da Habilitação */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Categoria CNH</span>
            <span className="font-bold text-white text-sm">Categoria D / E</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Identificador Funcional</span>
            <span className="font-mono text-brand-400 text-xs truncate block">{usuario?.id.substring(0, 8)}</span>
          </div>
        </div>

        {/* AVISO EXPRESSO OBRIGATÓRIO (D-31) */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-[11px] text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span className="font-semibold leading-relaxed">
            ATENÇÃO: Este documento comprova apenas a autorização funcional no sistema de frotas e NÃO substitui a Carteira Nacional de Habilitação (CNH) oficial perante os órgãos de trânsito.
          </span>
        </div>
      </div>
    </div>
  );
}

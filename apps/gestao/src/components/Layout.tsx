import React from 'react';
import { 
  Truck, 
  Users, 
  Fuel, 
  FileText, 
  ShieldCheck, 
  LayoutDashboard, 
  LogOut, 
  ChevronDown,
  Building2,
  CalendarCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  abaAtiva: string;
  onSelecionarAba: (aba: string) => void;
  children: React.ReactNode;
}

export function Layout({ abaAtiva, onSelecionarAba, children }: LayoutProps) {
  const { usuario, trocarPerfil, solicitarLogout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'veiculos', label: 'Frota & Veículos', icon: Truck },
    { id: 'motoristas', label: 'Condutores', icon: Users },
    { id: 'contratos', label: 'Fornecimento & Contratos', icon: FileText },
    { id: 'cotas', label: 'Cotas & Abastecimentos', icon: Fuel },
    { id: 'auditoria', label: 'Integridade & Auditoria', icon: ShieldCheck },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Barra Lateral (Sidebar) */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/30">
            <Fuel className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">GestFrota</h1>
            <p className="text-xs text-slate-400">Gestão Municipal</p>
          </div>
        </div>

        {/* Identificação do Ente Ativo */}
        <div className="px-5 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-500 shrink-0" />
          <div className="truncate">
            <p className="text-xs text-slate-400 font-medium">Município Ativo</p>
            <p className="text-xs font-semibold text-slate-200 truncate">
              {usuario?.perfilAtivo.enteNome || 'Prefeitura Municipal'}
            </p>
          </div>
        </div>

        {/* Navegação Principal */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const ativo = abaAtiva === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelecionarAba(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  ativo
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${ativo ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Rodapé do Usuário & Alternador de Perfil (Regra: Conta única, vários perfis) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-sm font-medium text-slate-200 truncate">{usuario?.nome}</p>
              <p className="text-xs text-slate-400 truncate">{usuario?.email}</p>
            </div>
            <button
              onClick={solicitarLogout}
              title="Encerrar Sessão"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Seletor de Perfis Disponíveis */}
          {usuario && usuario.perfis.length > 1 && (
            <div className="pt-2 border-t border-slate-800/80">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Trocar Perfil / Ente:
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                value={`${usuario.perfilAtivo.enteId}|${usuario.perfilAtivo.papel}`}
                onChange={(e) => {
                  const [enteId, papel] = e.target.value.split('|');
                  trocarPerfil(enteId, papel as any);
                }}
              >
                {usuario.perfis.map((p, idx) => (
                  <option key={idx} value={`${p.enteId}|${p.papel}`}>
                    {p.papel} — {p.enteNome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {usuario && usuario.perfis.length === 1 && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-[11px] font-medium text-brand-400">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              {usuario.perfilAtivo.papel}
            </div>
          )}
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">
              {menuItems.find((m) => m.id === abaAtiva)?.label || 'Painel'}
            </h2>
            <p className="text-xs text-slate-500">
              Sistema de Gestão de Frota, Combustível e Invariantes Auditáveis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              PostgreSQL 17 RLS Ativo
            </span>
          </div>
        </header>

        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

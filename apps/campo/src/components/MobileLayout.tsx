import React from 'react';
import { 
  Fuel, 
  ShieldCheck, 
  UserCheck, 
  Search, 
  LogOut, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Building2 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MobileLayoutProps {
  abaAtiva: string;
  onTrocarAba: (aba: string) => void;
  children: React.ReactNode;
}

export function MobileLayout({ abaAtiva, onTrocarAba, children }: MobileLayoutProps) {
  const { usuario, online, acoesPendentes, solicitarLogout, sincronizarAgora } = useAuth();
  const papel = usuario?.perfilAtivo.papel;
  const isMotorista = papel === 'MOTORISTA';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top Bar / Cabeçalho Mobile */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-brand-600/40">
              GF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">GestFrota</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Campo
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                {usuario?.perfilAtivo.enteNome || 'Prefeitura Municipal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Indicador de Conexão */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border ${
                online
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
              }`}
              title={online ? 'Conectado à internet' : 'Sem conexão - Modo offline ativo'}
            >
              {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>{online ? 'Online' : 'Offline'}</span>
            </div>

            {/* Botão Sair com modal de confirmação obrigatório */}
            <button
              onClick={solicitarLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Banner de Sincronização de Fila Offline */}
        {acoesPendentes > 0 && (
          <div className="mt-2 max-w-md mx-auto bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              {acoesPendentes} ação(ões) gravada(s) offline
            </span>
            <button
              onClick={() => sincronizarAgora()}
              disabled={!online}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-[10px] rounded-lg flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sincronizar</span>
            </button>
          </div>
        )}
      </header>

      {/* Conteúdo Principal da Tela */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4">
        {children}
      </main>

      {/* Barra de Navegação Inferior (Bottom Tabs) */}
      <nav className="sticky bottom-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-2 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {isMotorista ? (
            <>
              {/* Tab 1: Solicitar */}
              <button
                onClick={() => onTrocarAba('solicitar')}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
                  abaAtiva === 'solicitar'
                    ? 'text-brand-400 font-bold bg-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Fuel className="w-5 h-5" />
                <span className="text-[11px]">Solicitar</span>
              </button>

              {/* Tab 2: Confirmar Bilateral */}
              <button
                onClick={() => onTrocarAba('confirmar')}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
                  abaAtiva === 'confirmar'
                    ? 'text-brand-400 font-bold bg-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="text-[11px]">Bilateral</span>
              </button>

              {/* Tab 3: Credencial Funcional */}
              <button
                onClick={() => onTrocarAba('credencial')}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all ${
                  abaAtiva === 'credencial'
                    ? 'text-brand-400 font-bold bg-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-5 h-5" />
                <span className="text-[11px]">Credencial</span>
              </button>
            </>
          ) : (
            <>
              {/* Frentista Tab 1: Validar ABT */}
              <button
                onClick={() => onTrocarAba('validar')}
                className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition-all ${
                  abaAtiva === 'validar'
                    ? 'text-brand-400 font-bold bg-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Search className="w-5 h-5" />
                <span className="text-[11px]">Validar ABT</span>
              </button>

              {/* Frentista Tab 2: Registrar Abastecimento */}
              <button
                onClick={() => onTrocarAba('abastecer')}
                className={`flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition-all ${
                  abaAtiva === 'abastecer'
                    ? 'text-brand-400 font-bold bg-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Fuel className="w-5 h-5" />
                <span className="text-[11px]">Abastecer</span>
              </button>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}

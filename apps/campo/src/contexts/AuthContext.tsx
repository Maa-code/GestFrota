import React, { createContext, useContext, useState, useEffect } from 'react';
import { UsuarioSessao, PerfilAtivo, PapelUsuario } from '@gestfrota/contratos';
import { apiFetch } from '../lib/api';
import { offlineDb, sincronizarFilaOffline } from '../db/offlineDb';

interface AuthContextType {
  usuario: UsuarioSessao | null;
  carregando: boolean;
  online: boolean;
  acoesPendentes: number;
  login: (email: string, senha: string) => Promise<void>;
  trocarPerfil: (enteId: string, papel: PapelUsuario) => Promise<void>;
  solicitarLogout: () => void;
  confirmarLogout: () => Promise<void>;
  cancelarLogout: () => void;
  modalLogoutAberto: boolean;
  sincronizarAgora: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [acoesPendentes, setAcoesPendentes] = useState(0);
  const [modalLogoutAberto, setModalLogoutAberto] = useState(false);

  // Monitorar status de rede e fila offline
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkFila = async () => {
      const count = await offlineDb.filaOffline.where('status').equals('PENDENTE').count();
      setAcoesPendentes(count);
    };

    checkFila();
    const interval = setInterval(checkFila, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Checar sessão ativa
  useEffect(() => {
    async function checarSessao() {
      try {
        const dados = await apiFetch<UsuarioSessao>('/api/auth/me');
        setUsuario(dados);
      } catch {
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    }
    checarSessao();
  }, []);

  const login = async (email: string, senha: string) => {
    const res = await apiFetch<{ usuario: UsuarioSessao }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
    setUsuario(res.usuario);
  };

  const trocarPerfil = async (enteId: string, papel: PapelUsuario) => {
    const res = await apiFetch<{ perfilAtivo: PerfilAtivo }>('/api/auth/trocar-perfil', {
      method: 'POST',
      body: JSON.stringify({ enteId, papel }),
    });
    if (usuario) {
      setUsuario({ ...usuario, perfilAtivo: res.perfilAtivo });
    }
  };

  const solicitarLogout = () => setModalLogoutAberto(true);
  const cancelarLogout = () => setModalLogoutAberto(false);

  const confirmarLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUsuario(null);
      setModalLogoutAberto(false);
    }
  };

  const sincronizarAgora = async () => {
    await sincronizarFilaOffline();
    const count = await offlineDb.filaOffline.where('status').equals('PENDENTE').count();
    setAcoesPendentes(count);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        carregando,
        online,
        acoesPendentes,
        login,
        trocarPerfil,
        solicitarLogout,
        confirmarLogout,
        cancelarLogout,
        modalLogoutAberto,
        sincronizarAgora,
      }}
    >
      {children}

      {/* Modal de confirmação obrigatória de logout (Seção 2) */}
      {modalLogoutAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-xs w-full p-6 space-y-4 border border-slate-800 text-center">
            <h3 className="text-base font-bold text-white">Encerrar Sessão</h3>
            <p className="text-xs text-slate-400">
              Deseja realmente sair da sua conta no aplicativo de campo?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={cancelarLogout}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={confirmarLogout}
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}

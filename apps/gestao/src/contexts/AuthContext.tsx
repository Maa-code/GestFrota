import React, { createContext, useContext, useState, useEffect } from 'react';
import { UsuarioSessao, PerfilAtivo, PapelUsuario } from '@gestfrota/contratos';
import { apiFetch } from '../lib/api';

interface AuthContextType {
  usuario: UsuarioSessao | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  trocarPerfil: (enteId: string, papel: PapelUsuario) => Promise<void>;
  solicitarLogout: () => void;
  confirmarLogout: () => Promise<void>;
  cancelarLogout: () => void;
  modalLogoutAberto: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalLogoutAberto, setModalLogoutAberto] = useState(false);

  // Checar sessão ativa no carregamento
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
      setUsuario({
        ...usuario,
        perfilAtivo: res.perfilAtivo,
      });
    }
  };

  const solicitarLogout = () => {
    setModalLogoutAberto(true);
  };

  const cancelarLogout = () => {
    setModalLogoutAberto(false);
  };

  const confirmarLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUsuario(null);
      setModalLogoutAberto(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        carregando,
        login,
        trocarPerfil,
        solicitarLogout,
        confirmarLogout,
        cancelarLogout,
        modalLogoutAberto,
      }}
    >
      {children}

      {/* Modal de confirmação obrigatória de logout (requisito fixo da Seção 2) */}
      {modalLogoutAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Confirmar Saída</h3>
            <p className="text-sm text-slate-600">
              Tem certeza de que deseja encerrar sua sessão no painel do GestFrota?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={cancelarLogout}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Sim, Sair
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

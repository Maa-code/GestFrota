import React, { useState } from 'react';
import { Fuel, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await login(email.trim(), senha);
    } catch (err: any) {
      setErro(err.message || 'Falha na autenticação. Verifique suas credenciais.');
    } finally {
      setCarregando(false);
    }
  };

  const preencherDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setSenha('SenhaForte123!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center px-4 py-8 text-slate-100">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Brand / Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-brand-600 to-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-brand-500/20">
            <Fuel className="w-9 h-9 text-slate-950" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">GestFrota</h1>
            <p className="text-xs uppercase tracking-widest text-brand-400 font-bold">
              Aplicativo de Campo PWA
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Acesso para condutores municipais e frentistas de postos credenciados
          </p>
        </div>

        {/* Card Formulário */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200">
                {erro}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail Institucional ou Cadastrado
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@demo.gov.br"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              {carregando ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Entrar no Aplicativo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Atalhos de Demonstração */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="block text-[11px] text-slate-400 font-semibold text-center">
              Acesso Rápido de Teste (Demo Seed):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => preencherDemo('motorista@demo.gov.br')}
                className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors"
              >
                <div className="flex items-center gap-1.5 text-brand-400 font-bold text-xs mb-0.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Motorista</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">motorista@demo.gov.br</p>
              </button>

              <button
                type="button"
                onClick={() => preencherDemo('frentista@demo.gov.br')}
                className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-colors"
              >
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs mb-0.5">
                  <Fuel className="w-3.5 h-3.5" />
                  <span>Frentista</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">frentista@demo.gov.br</p>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé Informativo */}
        <p className="text-center text-[11px] text-slate-500">
          GestFrota v1.0 • PWA com Suporte Offline Conforme Seção 12.3
        </p>
      </div>
    </div>
  );
}

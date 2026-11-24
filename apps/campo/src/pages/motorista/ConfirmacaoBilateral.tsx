import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { enfileirarAcaoOffline } from '../../db/offlineDb';
import { useAuth } from '../../contexts/AuthContext';

export function ConfirmacaoBilateral() {
  const { online } = useAuth();
  const [autorizacaoId, setAutorizacaoId] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const payload = { autorizacaoId: autorizacaoId.trim() };

    try {
      if (!online) {
        await enfileirarAcaoOffline('CONFIRMAR_MOTORISTA', '/api/cotas/confirmar-motorista', payload);
        setConfirmado(true);
        alert('Confirmação salva offline. Será enviada à API assim que o sinal de internet retornar.');
        return;
      }

      await apiFetch('/api/cotas/confirmar-motorista', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setConfirmado(true);
    } catch (err: any) {
      setErro(err.message || 'Falha ao confirmar abastecimento');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Confirmação Bilateral</h2>
            <p className="text-xs text-slate-400">Requisito D-05 / D-06: Validação presencial do condutor</p>
          </div>
        </div>

        {confirmado ? (
          <div className="p-6 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="font-bold text-base text-white">Abastecimento Confirmado!</h3>
            <p className="text-xs text-slate-300">
              O consumo foi efetivado no razão de cotas e o abastecimento está apto para conferência fiscal e atesto.
            </p>
            <button
              onClick={() => {
                setConfirmado(false);
                setAutorizacaoId('');
              }}
              className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
            >
              Nova Confirmação
            </button>
          </div>
        ) : (
          <form onSubmit={handleConfirmar} className="space-y-4">
            {erro && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">
                {erro}
              </div>
            )}

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Confira atentamente os litros e a leitura do hodômetro exibidos na bomba antes de confirmar.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Identificador da Autorização (UUID)
              </label>
              <input
                type="text"
                required
                value={autorizacaoId}
                onChange={(e) => setAutorizacaoId(e.target.value)}
                placeholder="Ex: c1a2b3c4-d5e6-7890-..."
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {carregando ? 'Confirmando...' : 'Confirmar Abastecimento Realizado'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Fuel,
  Gauge,
  Car,
  DollarSign,
} from 'lucide-react';
import { CodigoAbtRegex } from '@gestfrota/contratos';
import { apiFetch } from '../../lib/api';
import { enfileirarAcaoOffline } from '../../db/offlineDb';
import { useAuth } from '../../contexts/AuthContext';

interface PendenteConfirmacao {
  autorizacao_id: string;
  codigo_abt: string;
  status: string;
  tipo_combustivel: string;
  litros_solicitados: string | number;
  placa: string;
  marca_modelo: string;
  tipo_medidor: string;
  posto_nome: string;
  abastecimento_id: string;
  litros_abastecidos: string | number;
  preco_unitario_aplicado: string | number;
  valor_total: string | number;
  medidor_leitura: string | number;
  abastecido_em: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ConfirmacaoBilateral() {
  const { online } = useAuth();
  const [pendentes, setPendentes] = useState<PendenteConfirmacao[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [confirmado, setConfirmado] = useState<{ codigoAbt?: string; offline?: boolean } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPendentes = useCallback(async () => {
    if (!online) return;
    setCarregandoLista(true);
    try {
      const lista = await apiFetch<PendenteConfirmacao[]>('/api/cotas/pendentes-motorista');
      setPendentes(lista);
    } catch {
      // Silencioso para não bloquear digitação manual em caso de falha momentânea
    } finally {
      setCarregandoLista(false);
    }
  }, [online]);

  useEffect(() => {
    carregarPendentes();
  }, [carregarPendentes]);

  const formatarCodigoAbt = (val: string) => {
    const trimmed = val.trim();
    if (UUID_REGEX.test(trimmed)) return trimmed;
    let clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean.startsWith('ABT') && clean.length > 0 && clean.startsWith('A') === false) {
      return trimmed.toUpperCase();
    }
    if (clean.startsWith('ABT')) {
      if (clean.length > 3 && clean.length <= 7) {
        return `${clean.slice(0, 3)}-${clean.slice(3)}`;
      }
      if (clean.length > 7) {
        return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 13)}`;
      }
    }
    return trimmed.toUpperCase();
  };

  const enviarConfirmacao = async (payload: { autorizacaoId?: string; codigoAbt?: string }, labelCodigo?: string) => {
    setErro(null);
    setCarregando(true);

    try {
      if (!online) {
        await enfileirarAcaoOffline('CONFIRMAR_MOTORISTA', '/api/cotas/confirmar-motorista', payload);
        setConfirmado({ codigoAbt: labelCodigo || payload.codigoAbt, offline: true });
        return;
      }

      const res = await apiFetch<any>('/api/cotas/confirmar-motorista', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setConfirmado({ codigoAbt: res?.codigoAbt || labelCodigo || payload.codigoAbt });
      setCodigoManual('');
      await carregarPendentes();
    } catch (err: any) {
      setErro(err.message || 'Falha ao confirmar abastecimento');
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmarPendente = async (item: PendenteConfirmacao) => {
    await enviarConfirmacao({ autorizacaoId: item.autorizacao_id }, item.codigo_abt);
  };

  const handleConfirmarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = codigoManual.trim();
    if (!valor) return;

    if (UUID_REGEX.test(valor)) {
      await enviarConfirmacao({ autorizacaoId: valor });
      return;
    }

    const codigoNormalizado = valor.toUpperCase();
    if (!CodigoAbtRegex.test(codigoNormalizado)) {
      setErro('Informe o código ABT válido no formato ABT-AAAA-XXXXXX.');
      return;
    }

    await enviarConfirmacao({ codigoAbt: codigoNormalizado }, codigoNormalizado);
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Confirmação Bilateral</h2>
              <p className="text-xs text-slate-400">Requisito D-05 / D-06: Validação presencial do condutor</p>
            </div>
          </div>

          {online && !confirmado && (
            <button
              type="button"
              onClick={carregarPendentes}
              disabled={carregandoLista}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
              title="Atualizar lista de abastecimentos aguardando confirmação"
            >
              <RefreshCw className={`w-4 h-4 ${carregandoLista ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {confirmado ? (
          <div className="p-6 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="font-bold text-base text-white">
              {confirmado.offline ? 'Confirmação Salva Offline!' : 'Abastecimento Confirmado!'}
            </h3>
            {confirmado.codigoAbt && (
              <p className="text-xs font-mono font-bold text-emerald-300">{confirmado.codigoAbt}</p>
            )}
            <p className="text-xs text-slate-300">
              {confirmado.offline
                ? 'A confirmação foi gravada no celular e será enviada automaticamente à API assim que a internet retornar.'
                : 'O consumo real foi efetivado no razão de cotas e eventual sobra reservada foi devolvida ao veículo.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirmado(null);
                setCodigoManual('');
                carregarPendentes();
              }}
              className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
            >
              Voltar às Pendências
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {erro && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300">
                {erro}
              </div>
            )}

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Confira atentamente os litros abastecidos e a leitura do hodômetro na bomba antes de confirmar.
              </span>
            </div>

            {/* Lista automática de abastecimentos aguardando aceite do motorista */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Aguardando sua confirmação ({pendentes.length})
              </h3>

              {carregandoLista && pendentes.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  Buscando abastecimentos registrados pelo posto...
                </div>
              ) : pendentes.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  {online
                    ? 'Nenhum abastecimento pendente encontrado. Assim que o frentista finalizar a bomba, toque em atualizar.'
                    : 'Modo offline ativo. Você pode confirmar informando o código ABT abaixo.'}
                </div>
              ) : (
                pendentes.map((item) => (
                  <div
                    key={item.autorizacao_id}
                    className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-mono font-bold text-sm text-brand-400">{item.codigo_abt}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                        {item.posto_nome}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/70">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 uppercase font-bold">
                          <Car className="w-3 h-3 text-brand-400" /> Veículo
                        </span>
                        <span className="font-mono font-bold text-white">{item.placa}</span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/70">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 uppercase font-bold">
                          <Fuel className="w-3 h-3 text-amber-400" /> Abastecido
                        </span>
                        <span className="font-mono font-bold text-amber-300">
                          {Number(item.litros_abastecidos).toFixed(2)} L
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/70">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 uppercase font-bold">
                          <DollarSign className="w-3 h-3 text-emerald-400" /> Valor Total
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          R$ {Number(item.valor_total).toFixed(2)}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800/70">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 uppercase font-bold">
                          <Gauge className="w-3 h-3 text-cyan-400" /> Medidor
                        </span>
                        <span className="font-mono font-bold text-white">
                          {Number(item.medidor_leitura)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={carregando}
                      onClick={() => handleConfirmarPendente(item)}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{carregando ? 'Confirmando...' : 'Confirmar Este Abastecimento'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Opção manual usando o mesmo código ABT (ou offline) */}
            <form onSubmit={handleConfirmarManual} className="pt-3 border-t border-slate-800 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Ou confirmar pelo Código ABT (o mesmo entregue ao frentista)
                </label>
                <input
                  type="text"
                  required
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(formatarCodigoAbt(e.target.value))}
                  placeholder="Ex: ABT-2026-XXXXXX"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono font-bold tracking-wider text-brand-400 focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={carregando || !codigoManual.trim()}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {carregando ? 'Confirmando...' : 'Confirmar pelo Código ABT'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

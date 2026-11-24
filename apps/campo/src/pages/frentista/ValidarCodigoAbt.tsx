import React, { useState } from 'react';
import { Search, Fuel, AlertCircle, CheckCircle2, ArrowRight, ShieldAlert, Clock, Gauge, Car } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { CodigoAbtRegex } from '@gestfrota/contratos';

interface ValidarCodigoAbtProps {
  onProsseguirAbastecimento?: (autorizacao: any) => void;
}

export function ValidarCodigoAbt({ onProsseguirAbastecimento }: ValidarCodigoAbtProps) {
  const [codigoInput, setCodigoInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [autorizacao, setAutorizacao] = useState<any | null>(null);

  const formatarCodigo = (val: string) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean.startsWith('ABT') && clean.length > 0) {
      clean = 'ABT' + clean;
    }
    // Formata como ABT-AAAA-XXXXXX
    if (clean.length > 3 && clean.length <= 7) {
      return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    } else if (clean.length > 7) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 13)}`;
    }
    return clean;
  };

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAutorizacao(null);

    const codigoLimpo = codigoInput.trim().toUpperCase();

    if (!CodigoAbtRegex.test(codigoLimpo)) {
      setErro('Formato do código deve ser ABT-AAAA-XXXXXX');
      return;
    }

    setCarregando(true);
    try {
      const data = await apiFetch<any>(`/api/cotas/autorizacao/${codigoLimpo}`);
      setAutorizacao(data);
    } catch (err: any) {
      setErro(err.message || 'Código não encontrado ou inválido');
    } finally {
      setCarregando(false);
    }
  };

  const isExpirado = autorizacao && new Date() > new Date(autorizacao.validade_limite);
  const isValidaParaAbastecer = autorizacao && autorizacao.status === 'RESERVADA' && !isExpirado;

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Validar Autorização</h2>
            <p className="text-xs text-slate-400">Verificação do código ABT apresentado pelo condutor</p>
          </div>
        </div>

        <form onSubmit={handleConsultar} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Código de Abastecimento (ABT)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={17}
                value={codigoInput}
                onChange={(e) => setCodigoInput(formatarCodigo(e.target.value))}
                placeholder="ABT-2026-XXXXXX"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-base font-mono font-bold tracking-widest text-brand-400 uppercase focus:outline-none focus:border-brand-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={carregando || !codigoInput}
                className="absolute right-2 top-2 bottom-2 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                {carregando ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>Consultar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Solicite ao condutor o código alfanumérico exibido na tela do app dele.
            </p>
          </div>
        </form>

        {erro && (
          <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {autorizacao && (
          <div className="space-y-4 pt-2">
            {/* Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                isValidaParaAbastecer
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/40 border-red-800 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isValidaParaAbastecer ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <h4 className="font-bold text-sm text-white">
                    {isValidaParaAbastecer
                      ? 'Autorização Válida para Abastecimento'
                      : `Não Apto: Status ${autorizacao.status}`}
                  </h4>
                  <p className="text-xs opacity-90">
                    {isExpirado
                      ? 'Prazo de 1 hora esgotado. Reserva expirada automaticamente.'
                      : isValidaParaAbastecer
                      ? 'Cota reservada no razão do ente público.'
                      : `Status atual: ${autorizacao.status}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Ficha da Autorização */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400 font-mono">{autorizacao.codigo_abt}</span>
                <span className="font-semibold text-slate-300">{autorizacao.posto_nome}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Car className="w-3.5 h-3.5 text-brand-400" />
                    <span className="text-[10px] uppercase font-bold">Veículo / Placa</span>
                  </div>
                  <p className="font-mono font-bold text-sm text-white">{autorizacao.placa}</p>
                  <p className="text-[11px] text-slate-400 truncate">{autorizacao.marca_modelo}</p>
                </div>

                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] uppercase font-bold">Combustível</span>
                  </div>
                  <p className="font-bold text-sm text-amber-300">{autorizacao.tipo_combustivel}</p>
                  <p className="text-[11px] text-slate-400">Até {autorizacao.litros_solicitados} L</p>
                </div>

                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold">Tanque Máximo (D-11)</span>
                  </div>
                  <p className="font-bold text-sm text-white">{autorizacao.capacidade_tanque_litros} L</p>
                  <p className="text-[11px] text-slate-500">Trava rígida de segurança</p>
                </div>

                <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] uppercase font-bold">Preço Máx. Contratado (D-02)</span>
                  </div>
                  <p className="font-bold text-sm text-emerald-400">
                    R$ {Number(autorizacao.instantaneo_preco_unitario).toFixed(3)}
                  </p>
                  <p className="text-[11px] text-slate-500">Teto licitatório</p>
                </div>
              </div>

              <div className="pt-2 text-slate-400 text-[11px] flex justify-between">
                <span>Motorista: <strong className="text-white">{autorizacao.motorista_nome}</strong></span>
                <span>Validade: <strong className="text-white">{new Date(autorizacao.validade_limite).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
              </div>
            </div>

            {/* Ação de Abastecer */}
            {isValidaParaAbastecer && onProsseguirAbastecimento && (
              <button
                onClick={() => onProsseguirAbastecimento(autorizacao)}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
              >
                <span>Prosseguir para Registro de Abastecimento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

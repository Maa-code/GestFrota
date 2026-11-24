import React, { useState, useEffect } from 'react';
import { Fuel, Gauge, DollarSign, AlertCircle, CheckCircle2, ShieldCheck, Camera, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { enfileirarAcaoOffline } from '../../db/offlineDb';
import { useAuth } from '../../contexts/AuthContext';

interface RegistrarAbastecimentoProps {
  autorizacaoPrevia?: any;
  onVoltar?: () => void;
}

export function RegistrarAbastecimento({ autorizacaoPrevia, onVoltar }: RegistrarAbastecimentoProps) {
  const { online } = useAuth();
  
  const [codigoAbt, setCodigoAbt] = useState(autorizacaoPrevia?.codigo_abt || '');
  const [litros, setLitros] = useState<number | ''>(autorizacaoPrevia?.litros_solicitados || '');
  const [precoUnitario, setPrecoUnitario] = useState<number | ''>(
    autorizacaoPrevia ? Number(autorizacaoPrevia.instantaneo_preco_unitario) : ''
  );
  const [medidorLeitura, setMedidorLeitura] = useState<number | ''>('');
  const [fotoPainelUrl, setFotoPainelUrl] = useState('');
  const [fotoBombaUrl, setFotoBombaUrl] = useState('');

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  // Se veio prévia, sincroniza se mudar
  useEffect(() => {
    if (autorizacaoPrevia) {
      setCodigoAbt(autorizacaoPrevia.codigo_abt);
      setLitros(autorizacaoPrevia.litros_solicitados);
      setPrecoUnitario(Number(autorizacaoPrevia.instantaneo_preco_unitario));
    }
  }, [autorizacaoPrevia]);

  const valorTotalCalculado =
    typeof litros === 'number' && typeof precoUnitario === 'number'
      ? (litros * precoUnitario).toFixed(2)
      : '0.00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const l = Number(litros);
    const p = Number(precoUnitario);
    const m = Number(medidorLeitura);

    if (!codigoAbt.trim()) {
      setErro('Informe o código de autorização ABT.');
      return;
    }
    if (isNaN(l) || l <= 0) {
      setErro('Quantidade de litros deve ser maior que zero.');
      return;
    }
    if (isNaN(p) || p <= 0) {
      setErro('Preço unitário deve ser maior que zero.');
      return;
    }
    if (isNaN(m) || m < 0) {
      setErro('Informe a leitura atual do odômetro ou horímetro.');
      return;
    }

    // Invariante D-11: Trava de capacidade do tanque se tiver autorizacaoPrevia
    if (autorizacaoPrevia && l > Number(autorizacaoPrevia.capacidade_tanque_litros)) {
      setErro(
        `Volume (${l} L) excede a capacidade física máxima do tanque deste veículo (${autorizacaoPrevia.capacidade_tanque_litros} L) conforme regra D-11.`
      );
      return;
    }

    // Invariante D-02: Teto de preço licitatório
    if (autorizacaoPrevia && p > Number(autorizacaoPrevia.instantaneo_preco_unitario)) {
      setErro(
        `Preço informado (R$ ${p.toFixed(3)}) é superior ao teto contratado pelo ente público (R$ ${Number(autorizacaoPrevia.instantaneo_preco_unitario).toFixed(3)}).`
      );
      return;
    }

    setCarregando(true);

    const payload = {
      codigoAbt: codigoAbt.trim().toUpperCase(),
      litrosAbastecidos: l,
      precoUnitario: p,
      medidorLeitura: m,
      fotoPainelUrl: fotoPainelUrl.trim() || undefined,
      fotoBombaUrl: fotoBombaUrl.trim() || undefined,
    };

    try {
      if (!online) {
        // Enfileiramento offline (Seção 12.3)
        await enfileirarAcaoOffline('CONFIRMAR_FRENTISTA', '/api/cotas/confirmar-frentista', payload);
        setConcluido(true);
        setResultado({
          mensagem: 'Abastecimento registrado offline no celular do posto. Será sincronizado com o servidor assim que houver sinal de internet.',
          offline: true,
        });
        return;
      }

      const res = await apiFetch<any>('/api/cotas/confirmar-frentista', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setResultado(res);
      setConcluido(true);
    } catch (err: any) {
      setErro(err.message || 'Falha ao registrar abastecimento');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-600/20 text-brand-400 rounded-xl">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Registrar Abastecimento</h2>
              <p className="text-xs text-slate-400">Apontamento de bomba pelo frentista do posto</p>
            </div>
          </div>
          {onVoltar && (
            <button
              onClick={onVoltar}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>
          )}
        </div>

        {concluido ? (
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-white">Registro Efetuado!</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                {resultado?.mensagem || 'Abastecimento registrado com sucesso.'}
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2 text-left">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Próximo passo obrigatório (D-05/D-06):</strong> O motorista deve abrir o aplicativo dele agora e realizar a confirmação bilateral presencial para liquidação do abastecimento.
              </span>
            </div>

            <button
              onClick={() => {
                setConcluido(false);
                setResultado(null);
                setCodigoAbt('');
                setLitros('');
                setMedidorLeitura('');
                if (onVoltar) onVoltar();
              }}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Novo Atendimento
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && (
              <div className="p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            {/* Código ABT */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Código de Autorização (ABT)
              </label>
              <input
                type="text"
                required
                value={codigoAbt}
                onChange={(e) => setCodigoAbt(e.target.value.toUpperCase())}
                placeholder="ABT-2026-XXXXXX"
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono font-bold tracking-wider text-brand-400 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Invariantes em destaque se tiver dados prévios */}
            {autorizacaoPrevia && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Veículo / Tanque Máx</span>
                  <strong className="text-white font-mono">{autorizacaoPrevia.placa} ({autorizacaoPrevia.capacidade_tanque_litros} L)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Teto Preço Licitatório</span>
                  <strong className="text-emerald-400 font-mono">R$ {Number(autorizacaoPrevia.instantaneo_preco_unitario).toFixed(3)}</strong>
                </div>
              </div>
            )}

            {/* Litros e Preço Unitário */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Litros na Bomba
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={litros}
                    onChange={(e) => setLitros(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 45.5"
                    className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-500 font-bold">L</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Preço Unitário (R$)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={precoUnitario}
                    onChange={(e) => setPrecoUnitario(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 5.890"
                    className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono font-bold text-white focus:outline-none focus:border-brand-500"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-500 font-bold">R$</span>
                </div>
              </div>
            </div>

            {/* Total Calculado */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Valor Total do Abastecimento:
              </span>
              <span className="text-base font-mono font-extrabold text-emerald-400">
                R$ {valorTotalCalculado}
              </span>
            </div>

            {/* Medidor (Odômetro / Horímetro - D-11) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Leitura do Painel (Odômetro / Horímetro)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={medidorLeitura}
                  onChange={(e) => setMedidorLeitura(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 124500"
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                />
                <Gauge className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-500" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Conforme norma de controle de frota, a leitura do hodômetro deve ser estritamente crescente.
              </p>
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={carregando}
              className="w-full py-4 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 text-white font-bold text-sm rounded-2xl shadow-lg shadow-brand-600/30 transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {carregando ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar e Finalizar Bomba</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

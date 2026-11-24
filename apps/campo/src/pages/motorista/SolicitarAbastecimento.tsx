import React, { useState, useEffect } from 'react';
import { Fuel, Clock, AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { offlineDb, enfileirarAcaoOffline } from '../../db/offlineDb';
import { useAuth } from '../../contexts/AuthContext';

export function SolicitarAbastecimento() {
  const { online } = useAuth();
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [postos, setPostos] = useState<any[]>([]);
  const [veiculoId, setVeiculoId] = useState('');
  const [postoId, setPostoId] = useState('');
  const [litros, setLitros] = useState(40);
  const [combustivel, setCombustivel] = useState('DIESEL_S10');
  
  const [autorizacaoAtiva, setAutorizacaoAtiva] = useState<any | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function carregarDados() {
      try {
        const [veics, pts] = await Promise.all([
          apiFetch<any[]>('/api/frota/veiculos').catch(() => []),
          apiFetch<any[]>('/api/fornecimento/postos').catch(() => []),
        ]);
        setVeiculos(veics);
        setPostos(pts);
        if (veics.length > 0) {
          setVeiculoId(veics[0].id);
          setCombustivel(veics[0].combustivel_padrao);
        }
        if (pts.length > 0) setPostoId(pts[0].id);

        // Salva cache offline
        await offlineDb.veiculosCache.bulkPut(
          veics.map((v) => ({
            id: v.id,
            placa: v.placa,
            marcaModelo: v.marca_modelo,
            capacidadeTanqueLitros: v.capacidade_tanque_litros,
            combustivelPadrao: v.combustivel_padrao,
          }))
        );
      } catch {
        // Fallback para cache local se offline
        const cached = await offlineDb.veiculosCache.toArray();
        setVeiculos(cached);
        if (cached.length > 0) setVeiculoId(cached[0].id);
      }
    }
    carregarDados();
  }, []);

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const payload = {
      veiculoId,
      postoId,
      tipoCombustivel: combustivel,
      litrosSolicitados: Number(litros),
    };

    try {
      if (!online) {
        // Modo offline resiliente (Seção 12.3)
        await enfileirarAcaoOffline('SOLICITAR_ABASTECIMENTO', '/api/cotas/solicitar-abastecimento', payload);
        alert('Você está sem conexão. A solicitação foi enfileirada no celular e será emitida automaticamente quando a rede retornar.');
        return;
      }

      const res = await apiFetch<any>('/api/cotas/solicitar-abastecimento', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setAutorizacaoAtiva(res);
      // Salva no cache local
      await offlineDb.autorizacoesCache.put({
        id: res.id,
        codigoAbt: res.codigo_abt,
        status: res.status,
        veiculoId,
        placa: veiculos.find((v) => v.id === veiculoId)?.placa || '',
        litrosSolicitados: Number(litros),
        tipoCombustivel: combustivel,
        validadeLimite: res.validade_limite,
        criadoEm: new Date().toISOString(),
      });
    } catch (err: any) {
      setErro(err.message || 'Falha ao solicitar autorização');
    } finally {
      setCarregando(false);
    }
  };

  const copiarCodigo = () => {
    if (!autorizacaoAtiva) return;
    navigator.clipboard.writeText(autorizacaoAtiva.codigo_abt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Exibição do Código ABT em Destaque de Alto Contraste (Regra: ZERO QR CODE) */}
      {autorizacaoAtiva ? (
        <div className="bg-slate-900 border-2 border-brand-500 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping"></span>
            Código Ativo para Abastecimento
          </div>

          <div className="py-2">
            <p className="text-xs text-slate-400 mb-1">Apresente este código ao frentista:</p>
            <div className="bg-black/80 rounded-2xl p-4 border border-slate-800">
              <span className="font-mono font-black text-3xl sm:text-4xl text-brand-400 tracking-wider select-all">
                {autorizacaoAtiva.codigo_abt}
              </span>
            </div>
          </div>

          <button
            onClick={copiarCodigo}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            {copiado ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> Copiado para a Área de Transferência
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copiar Código
              </>
            )}
          </button>

          <div className="p-3 bg-slate-950/60 rounded-xl text-left text-xs space-y-1.5 border border-slate-800/80">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Volume Reservado:</span>
              <span className="font-bold text-white">{autorizacaoAtiva.litros_solicitados} L</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Valor Estimado:</span>
              <span className="font-bold text-emerald-400">R$ {Number(autorizacaoAtiva.valor_estimado).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Válido até:</span>
              <span className="font-mono text-amber-400">
                {new Date(autorizacaoAtiva.validade_limite).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            * Conforme Seção 2 da norma municipal, não são gerados QR codes. O frentista digitará o código no sistema.
          </p>

          <button
            onClick={() => setAutorizacaoAtiva(null)}
            className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Nova Solicitação
          </button>
        </div>
      ) : (
        /* Formulário de Solicitação */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <div className="p-2 bg-brand-600/20 text-brand-400 rounded-xl">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Solicitar Abastecimento</h2>
              <p className="text-xs text-slate-400">Emissão do código com reserva atômica (D-01 / D-05)</p>
            </div>
          </div>

          {erro && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSolicitar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Veículo Autorizado
              </label>
              <select
                value={veiculoId}
                onChange={(e) => {
                  setVeiculoId(e.target.value);
                  const v = veiculos.find((item) => item.id === e.target.value);
                  if (v) setCombustivel(v.combustivel_padrao);
                }}
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} — {v.marca_modelo} ({v.capacidade_tanque_litros} L)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Posto de Abastecimento (D-05)
              </label>
              <select
                value={postoId}
                onChange={(e) => setPostoId(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {postos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.endereco}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">
                O código emitido só terá validade no posto selecionado.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Combustível</label>
                <input
                  type="text"
                  disabled
                  value={combustivel}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-brand-400 opacity-80"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Litros Desejados</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="500"
                  value={litros}
                  onChange={(e) => setLitros(Number(e.target.value))}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-bold text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {carregando ? (
                'Gerando autorização...'
              ) : (
                <>
                  <Fuel className="w-4 h-4" /> Gerar Código de Abastecimento
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

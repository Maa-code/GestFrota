import React, { useEffect, useState } from 'react';
import { Truck, Plus, Search, Filter, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Veiculo {
  id: string;
  placa: string;
  marca_modelo: string;
  ano_fabricacao: number;
  tipo: string;
  tipo_medidor: string;
  capacidade_tanque_litros: number;
  combustivel_padrao: string;
  secretaria_nome: string;
  secretaria_sigla: string;
}

export function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroCombustivel, setFiltroCombustivel] = useState('TODOS');
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  // Form states (D-11: capacidade do tanque obrigatória)
  const [placa, setPlaca] = useState('');
  const [marcaModelo, setMarcaModelo] = useState('');
  const [anoFabricacao, setAnoFabricacao] = useState(2024);
  const [tipoMedidor, setTipoMedidor] = useState('HODOMETRO');
  const [capacidadeTanque, setCapacidadeTanque] = useState(60);
  const [combustivelPadrao, setCombustivelPadrao] = useState('DIESEL_S10');
  const [secretarias, setSecretarias] = useState<any[]>([]);
  const [secretariaId, setSecretariaId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [veics, secs] = await Promise.all([
        apiFetch<Veiculo[]>('/api/frota/veiculos'),
        apiFetch<any[]>('/api/organizacao/secretarias').catch(() => []),
      ]);
      setVeiculos(veics);
      setSecretarias(secs);
      if (secs.length > 0 && !secretariaId) {
        setSecretariaId(secs[0].id);
      }
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await apiFetch('/api/frota/veiculos', {
        method: 'POST',
        body: JSON.stringify({
          secretariaId,
          placa: placa.toUpperCase().trim(),
          marcaModelo,
          anoFabricacao: Number(anoFabricacao),
          tipoMedidor,
          capacidadeTanqueLitros: Number(capacidadeTanque),
          combustivelPadrao,
          tipo: 'PROPRIO',
        }),
      });
      setModalAberto(false);
      setPlaca('');
      setMarcaModelo('');
      await carregarDados();
    } catch (err: any) {
      setErro(err.message || 'Falha ao cadastrar veículo');
    } finally {
      setSalvando(false);
    }
  };

  const veiculosFiltrados = veiculos.filter((v) => {
    const matchBusca =
      v.placa.toLowerCase().includes(busca.toLowerCase()) ||
      v.marca_modelo.toLowerCase().includes(busca.toLowerCase());
    const matchCombustivel =
      filtroCombustivel === 'TODOS' || v.combustivel_padrao === filtroCombustivel;
    return matchBusca && matchCombustivel;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Barra de Ações e Filtros Padronizados (Regra da Seção 2: Todos/Nenhum) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por placa ou modelo..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filtroCombustivel}
              onChange={(e) => setFiltroCombustivel(e.target.value)}
              className="text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="TODOS">Todos os Combustíveis</option>
              <option value="DIESEL_S10">Diesel S10</option>
              <option value="DIESEL_S500">Diesel S500</option>
              <option value="GASOLINA_COMUM">Gasolina Comum</option>
              <option value="ETANOL">Etanol</option>
              <option value="GNV">GNV</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setModalAberto(true)}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-brand-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Veículo
        </button>
      </div>

      {/* Tabela de Veículos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">Placa & Modelo</th>
                <th className="px-6 py-4">Secretaria</th>
                <th className="px-6 py-4">Medidor</th>
                <th className="px-6 py-4">Capacidade (D-11)</th>
                <th className="px-6 py-4">Combustível</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Carregando frota...
                  </td>
                </tr>
              ) : veiculosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Nenhum veículo encontrado.
                  </td>
                </tr>
              ) : (
                veiculosFiltrados.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200 text-xs">
                          {v.placa.substring(0, 3)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{v.placa}</p>
                          <p className="text-xs text-slate-500">{v.marca_modelo} ({v.ano_fabricacao})</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-800">{v.secretaria_sigla || 'SMS'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                        {v.tipo_medidor}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-900">
                        {v.capacidade_tanque_litros} L
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                        {v.combustivel_padrao}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Ativo
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro de Veículo (D-11: capacidade obrigatória) */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Cadastrar Novo Veículo</h3>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {erro && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Placa (Mercosul/Antiga)</label>
                  <input
                    type="text"
                    required
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    placeholder="BRA2E19"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm uppercase focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ano de Fabricação</label>
                  <input
                    type="number"
                    required
                    value={anoFabricacao}
                    onChange={(e) => setAnoFabricacao(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marca / Modelo</label>
                <input
                  type="text"
                  required
                  value={marcaModelo}
                  onChange={(e) => setMarcaModelo(e.target.value)}
                  placeholder="Ex: Van Ambulância Master"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Capacidade do Tanque (Litros)*
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={capacidadeTanque}
                    onChange={(e) => setCapacidadeTanque(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20"
                  />
                  <span className="text-[10px] text-slate-400">Obrigatória conforme D-11</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Medidor</label>
                  <select
                    value={tipoMedidor}
                    onChange={(e) => setTipoMedidor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                  >
                    <option value="HODOMETRO">Hodômetro (KM)</option>
                    <option value="HORIMETRO">Horímetro (Horas)</option>
                    <option value="NENHUM">Nenhum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Combustível Padrão</label>
                  <select
                    value={combustivelPadrao}
                    onChange={(e) => setCombustivelPadrao(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                  >
                    <option value="DIESEL_S10">Diesel S10</option>
                    <option value="DIESEL_S500">Diesel S500</option>
                    <option value="GASOLINA_COMUM">Gasolina Comum</option>
                    <option value="ETANOL">Etanol</option>
                    <option value="GNV">GNV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Secretaria</label>
                  <select
                    value={secretariaId}
                    onChange={(e) => setSecretariaId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white"
                  >
                    {secretarias.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome} ({s.sigla})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium shadow-md shadow-brand-600/20 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

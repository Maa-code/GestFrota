import Dexie, { Table } from 'dexie';

export interface ItemFilaOffline {
  id?: number;
  tipo: 'CONFIRMAR_MOTORISTA' | 'CONFIRMAR_FRENTISTA' | 'SOLICITAR_ABASTECIMENTO';
  endpoint: string;
  payload: any;
  criadoEm: number;
  status: 'PENDENTE' | 'SINCRONIZANDO' | 'FALHA';
  tentativas: number;
  erroUltimo?: string;
}

export interface AutorizacaoCache {
  id: string;
  codigoAbt: string;
  status: string;
  veiculoId: string;
  placa: string;
  litrosSolicitados: number;
  tipoCombustivel: string;
  postoNome?: string;
  validadeLimite: string;
  criadoEm: string;
}

export interface VeiculoCache {
  id: string;
  placa: string;
  marcaModelo: string;
  capacidadeTanqueLitros: number;
  combustivelPadrao: string;
}

export class GestFrotaOfflineDB extends Dexie {
  filaOffline!: Table<ItemFilaOffline, number>;
  autorizacoesCache!: Table<AutorizacaoCache, string>;
  veiculosCache!: Table<VeiculoCache, string>;

  constructor() {
    super('GestFrotaCampoDB');
    this.version(1).stores({
      filaOffline: '++id, tipo, status, criadoEm',
      autorizacoesCache: 'id, codigoAbt, veiculoId, status',
      veiculosCache: 'id, placa',
    });
  }
}

export const offlineDb = new GestFrotaOfflineDB();

/**
 * Adiciona uma ação à fila offline quando a rede estiver instável
 */
export async function enfileirarAcaoOffline(
  tipo: ItemFilaOffline['tipo'],
  endpoint: string,
  payload: any
): Promise<number> {
  const id = await offlineDb.filaOffline.add({
    tipo,
    endpoint,
    payload,
    criadoEm: Date.now(),
    status: 'PENDENTE',
    tentativas: 0,
  });
  console.log(`[OfflineDB] Ação enfileirada com id ${id}: ${tipo}`);
  return id as number;
}

/**
 * Motor de sincronização da fila offline ao restabelecer conectividade
 */
export async function sincronizarFilaOffline(): Promise<{ sincronizados: number; falhas: number }> {
  if (!navigator.onLine) {
    return { sincronizados: 0, falhas: 0 };
  }

  const pendentes = await offlineDb.filaOffline
    .where('status')
    .equals('PENDENTE')
    .sortBy('criadoEm');

  let sincronizados = 0;
  let falhas = 0;

  for (const item of pendentes) {
    try {
      await offlineDb.filaOffline.update(item.id!, { status: 'SINCRONIZANDO' });

      const res = await fetch(item.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.erro || `HTTP ${res.status}`);
      }

      // Sucesso: remove da fila local
      await offlineDb.filaOffline.delete(item.id!);
      sincronizados++;
      console.log(`[OfflineDB] Item ${item.id} (${item.tipo}) sincronizado com sucesso.`);
    } catch (err: any) {
      falhas++;
      await offlineDb.filaOffline.update(item.id!, {
        status: 'FALHA',
        tentativas: item.tentativas + 1,
        erroUltimo: err.message,
      });
      console.warn(`[OfflineDB] Falha ao sincronizar item ${item.id}:`, err);
    }
  }

  return { sincronizados, falhas };
}

// Dispara sincronização automática ao detectar retorno de rede
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineDB] Conexão restabelecida. Disparando sincronização da fila...');
    sincronizarFilaOffline().catch(console.error);
  });
}

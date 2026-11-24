/**
 * Regras puras de domínio GestFrota
 */

export interface MedidorLeitura {
  anterior: number;
  atual: number;
  capacidadeTanqueLitros: number;
  litrosAbastecidos: number;
}

/**
 * D-11: Leitura do medidor sempre crescente, com salto plausível.
 */
export function validarLeituraMedidor(dados: MedidorLeitura): { valido: boolean; motivo?: string } {
  if (dados.atual < dados.anterior) {
    return { valido: false, motivo: 'Leitura atual do medidor não pode ser inferior à leitura anterior.' };
  }

  if (dados.litrosAbastecidos > dados.capacidadeTanqueLitros) {
    return {
      valido: false,
      motivo: `Volume abastecido (${dados.litrosAbastecidos} L) excede a capacidade do tanque (${dados.capacidadeTanqueLitros} L).`,
    };
  }

  return { valido: true };
}

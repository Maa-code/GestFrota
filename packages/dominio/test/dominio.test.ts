import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validarLeituraMedidor } from '../dist/index.js';

describe('Pacote Domínio - Regras Puras de Frota e Abastecimento', () => {
  it('1. Deve aprovar leitura estritamente crescente e volume dentro da capacidade', () => {
    const res = validarLeituraMedidor({
      anterior: 50000,
      atual: 50250,
      capacidadeTanqueLitros: 60,
      litrosAbastecidos: 45.5,
    });
    assert.strictEqual(res.valido, true);
  });

  it('2. D-11: Deve rejeitar leitura decrescente do hodômetro/horímetro', () => {
    const res = validarLeituraMedidor({
      anterior: 50000,
      atual: 49990,
      capacidadeTanqueLitros: 60,
      litrosAbastecidos: 40,
    });
    assert.strictEqual(res.valido, false);
    assert.match(res.motivo || '', /não pode ser inferior à leitura anterior/i);
  });

  it('3. D-11: Deve rejeitar volume abastecido que excede a capacidade física do tanque', () => {
    const res = validarLeituraMedidor({
      anterior: 50000,
      atual: 50100,
      capacidadeTanqueLitros: 55,
      litrosAbastecidos: 65,
    });
    assert.strictEqual(res.valido, false);
    assert.match(res.motivo || '', /excede a capacidade do tanque/i);
  });
});

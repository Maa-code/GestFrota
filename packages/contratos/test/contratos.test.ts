import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  validarCnpjAlfanumerico, 
  CnpjSchema, 
  ChaveNfeSchema, 
  CodigoAbtSchema 
} from '../dist/index.js';

describe('Pacote Contratos - Invariantes e Validações Zod', () => {
  it('1. Valida CNPJ numérico tradicional', () => {
    // 00.000.000/0001-91 (Banco do Brasil)
    const valido = validarCnpjAlfanumerico('00.000.000/0001-91');
    assert.strictEqual(valido, true);

    const parsed = CnpjSchema.safeParse('00.000.000/0001-91');
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.strictEqual(parsed.data, '00000000000191');
    }
  });

  it('2. Valida CNPJ alfanumérico conforme NT 2026.004 / IN RFB 2.229/2024', () => {
    // Exemplo com caracteres alfanuméricos ASCII 48
    // 12ABC34501DE35
    const parsed = CnpjSchema.safeParse('12.ABC.345/01DE-35');
    assert.strictEqual(parsed.success, true);

    const invalido = CnpjSchema.safeParse('12.ABC.345/01DE-99');
    assert.strictEqual(invalido.success, false);
  });

  it('3. Valida chave de acesso da NF-e com exatamente 44 caracteres alfanuméricos', () => {
    const chaveValida = '35240212345678000195550010000001011234567890';
    assert.strictEqual(chaveValida.length, 44);
    const parsed = ChaveNfeSchema.safeParse(chaveValida);
    assert.strictEqual(parsed.success, true);

    const chaveCurta = '35240212345678000195550010000001011234';
    const parsedCurta = ChaveNfeSchema.safeParse(chaveCurta);
    assert.strictEqual(parsedCurta.success, false);
  });

  it('4. Valida código de autorização no formato ABT-AAAA-XXXXXX', () => {
    const abtValido = 'ABT-2026-F98A1B';
    const parsed = CodigoAbtSchema.safeParse(abtValido);
    assert.strictEqual(parsed.success, true);

    const abtMinusculo = 'abt-2026-f98a1b';
    const parsedMin = CodigoAbtSchema.safeParse(abtMinusculo);
    assert.strictEqual(parsedMin.success, true);
    if (parsedMin.success) {
      assert.strictEqual(parsedMin.data, 'ABT-2026-F98A1B');
    }

    const abtInvalido = 'XYZ-2026-123456';
    const parsedInv = CodigoAbtSchema.safeParse(abtInvalido);
    assert.strictEqual(parsedInv.success, false);
  });
});

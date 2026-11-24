import { z } from 'zod';

/**
 * D-09: CNPJ alfanumérico (IN RFB 2.229/2024 & NT 2026.004)
 * Formato padrão: 12 caracteres alfanuméricos seguidos de 2 dígitos verificadores numéricos.
 */
export const CnpjAlfanumericoRegex = /^[A-Z0-9]{12}[0-9]{2}$/;

/**
 * Validação do dígito verificador módulo 11 para CNPJ alfanumérico:
 * Valor do caractere: ASCII - 48 (conforme NT 2026.004).
 */
export function validarCnpjAlfanumerico(cnpj: string): boolean {
  const limpo = cnpj.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (limpo.length !== 14) return false;

  const valores = limpo.split('').map((char) => char.charCodeAt(0) - 48);

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma1 = 0;
  for (let i = 0; i < 12; i++) {
    soma1 += valores[i] * pesos1[i];
  }
  let resto1 = soma1 % 11;
  let dv1 = resto1 < 2 ? 0 : 11 - resto1;
  if (valores[12] !== dv1) return false;

  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma2 = 0;
  for (let i = 0; i < 13; i++) {
    soma2 += valores[i] * pesos2[i];
  }
  let resto2 = soma2 % 11;
  let dv2 = resto2 < 2 ? 0 : 11 - resto2;
  return valores[13] === dv2;
}

export const CnpjSchema = z
  .string()
  .transform((val) => val.replace(/[^A-Z0-9]/g, '').toUpperCase())
  .refine(validarCnpjAlfanumerico, {
    message: 'CNPJ alfanumérico inválido conforme NT 2026.004',
  });

/**
 * D-09: Chave de acesso NF-e com 44 posições alfanuméricas.
 */
export const ChaveNfeRegex = /^[A-Z0-9]{44}$/;
export const ChaveNfeSchema = z
  .string()
  .transform((val) => val.replace(/[^A-Z0-9]/g, '').toUpperCase())
  .refine((val) => ChaveNfeRegex.test(val), {
    message: 'Chave de acesso da NF-e deve possuir exatamente 44 caracteres alfanuméricos',
  });

/**
 * D-05: Código de autorização ABT-AAAA-XXXXXX
 * AAAA: Ano
 * XXXXXX: Código único aleatório de 6 caracteres
 */
export const CodigoAbtRegex = /^ABT-\d{4}-[A-Z0-9]{6}$/;
export const CodigoAbtSchema = z
  .string()
  .transform((val) => val.toUpperCase().trim())
  .refine((val) => CodigoAbtRegex.test(val), {
    message: 'Código de autorização inválido. Formato esperado: ABT-AAAA-XXXXXX',
  });

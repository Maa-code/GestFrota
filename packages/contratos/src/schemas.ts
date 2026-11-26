import { z } from 'zod';

// ==============================================================================
// 1. Tipos Enumerados & Domínios
// ==============================================================================

export const TipoCombustivelSchema = z.enum([
  'GASOLINA_COMUM',
  'GASOLINA_ADITIVADA',
  'ETANOL',
  'DIESEL_S10',
  'DIESEL_S500',
  'GNV',
  'ARLA_32',
]);
export type TipoCombustivel = z.infer<typeof TipoCombustivelSchema>;

export const TipoMedidorSchema = z.enum(['HODOMETRO', 'HORIMETRO', 'NENHUM']);
export type TipoMedidor = z.infer<typeof TipoMedidorSchema>;

export const TipoVeiculoSchema = z.enum(['PROPRIO', 'LOCADO', 'CEDIDO']);
export type TipoVeiculo = z.infer<typeof TipoVeiculoSchema>;

export const PapelUsuarioSchema = z.enum([
  'GESTOR_GERAL',
  'GESTOR_SECRETARIA',
  'FISCAL_CONTRATO',
  'CONTROLE_INTERNO',
  'MOTORISTA',
  'FRENTISTA',
  'ADMIN_GERAL',
]);
export type PapelUsuario = z.infer<typeof PapelUsuarioSchema>;

export const StatusAutorizacaoSchema = z.enum([
  'PENDENTE',
  'RESERVADA',
  'CONFIRMADA_FRENTISTA',
  'CONFIRMADA_BILATERAL',
  'EXPIRADA',
  'CANCELADA',
]);
export type StatusAutorizacao = z.infer<typeof StatusAutorizacaoSchema>;

export const StatusFechamentoSchema = z.enum([
  'ABERTO',
  'EM_CONCILIACAO',
  'CONCILIADO',
  'ATESTADO',
  'LIQUIDADO',
]);
export type StatusFechamento = z.infer<typeof StatusFechamentoSchema>;

// ==============================================================================
// 2. Validações Especiais (D-09, D-05)
// ==============================================================================

/**
 * D-09: CNPJ alfanumérico (IN RFB 2.229/2024 & NT 2026.004)
 */
export const CnpjAlfanumericoRegex = /^[A-Z0-9]{12}[0-9]{2}$/;

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

export const ChaveNfeRegex = /^[A-Z0-9]{44}$/;
export const ChaveNfeSchema = z
  .string()
  .transform((val) => val.replace(/[^A-Z0-9]/g, '').toUpperCase())
  .refine((val) => ChaveNfeRegex.test(val), {
    message: 'Chave de acesso da NF-e deve possuir exatamente 44 caracteres alfanuméricos',
  });

export const CodigoAbtRegex = /^ABT-\d{4}-[A-Z0-9]{6}$/;
export const CodigoAbtSchema = z
  .string()
  .transform((val) => val.toUpperCase().trim())
  .refine((val) => CodigoAbtRegex.test(val), {
    message: 'Código de autorização inválido. Formato esperado: ABT-AAAA-XXXXXX',
  });

// ==============================================================================
// 3. Schemas de Autenticação & Sessão
// ==============================================================================

export const LoginRequestSchema = z.object({
  email: z.string().email('E-mail institucional inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const PerfilAtivoSchema = z.object({
  papel: PapelUsuarioSchema,
  enteId: z.string().uuid(),
  enteNome: z.string(),
  secretariaId: z.string().uuid().nullable().optional(),
  postoId: z.string().uuid().nullable().optional(),
});
export type PerfilAtivo = z.infer<typeof PerfilAtivoSchema>;

export const UsuarioSessaoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  email: z.string().email(),
  cpf: z.string(),
  perfis: z.array(PerfilAtivoSchema),
  perfilAtivo: PerfilAtivoSchema,
});
export type UsuarioSessao = z.infer<typeof UsuarioSessaoSchema>;

export const TrocarPerfilRequestSchema = z.object({
  enteId: z.string().uuid(),
  papel: PapelUsuarioSchema,
});
export type TrocarPerfilRequest = z.infer<typeof TrocarPerfilRequestSchema>;

// ==============================================================================
// 4. Schemas de Organização
// ==============================================================================

export const CriarEnteSchema = z.object({
  nome: z.string().min(3),
  cnpj: CnpjSchema,
  timezone: z.string().default('America/Sao_Paulo'),
});
export type CriarEnte = z.infer<typeof CriarEnteSchema>;

export const CriarSecretariaSchema = z.object({
  unidadeGestoraId: z.string().uuid(),
  nome: z.string().min(3),
  sigla: z.string().min(2).max(10).toUpperCase(),
});
export type CriarSecretaria = z.infer<typeof CriarSecretariaSchema>;

// ==============================================================================
// 5. Schemas de Frota & Condutores
// ==============================================================================

export const CriarVeiculoSchema = z.object({
  secretariaId: z.string().uuid(),
  placa: z.string().min(7).max(8).toUpperCase(),
  marcaModelo: z.string().min(2),
  anoFabricacao: z.number().int().min(1970).max(2035),
  tipo: TipoVeiculoSchema.default('PROPRIO'),
  tipoMedidor: TipoMedidorSchema.default('HODOMETRO'),
  capacidadeTanqueLitros: z.number().positive('Capacidade do tanque deve ser maior que zero'),
  combustivelPadrao: TipoCombustivelSchema,
});
export type CriarVeiculo = z.infer<typeof CriarVeiculoSchema>;

export const CriarMotoristaSchema = z.object({
  usuarioId: z.string().uuid(),
  numeroCnh: z.string().min(9).max(12),
  categoriaCnh: z.string().min(1).max(3).toUpperCase(),
  cnhValidade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de validade deve ser AAAA-MM-DD'),
});
export type CriarMotorista = z.infer<typeof CriarMotoristaSchema>;

// ==============================================================================
// 6. Schemas de Abastecimento (Fluxo Bilateral)
// ==============================================================================

export const SolicitarAutorizacaoSchema = z.object({
  veiculoId: z.string().uuid(),
  postoId: z.string().uuid(),
  tipoCombustivel: TipoCombustivelSchema,
  litrosSolicitados: z.number().positive(),
});
export type SolicitarAutorizacao = z.infer<typeof SolicitarAutorizacaoSchema>;

export const ConfirmarFrentistaSchema = z.object({
  codigoAbt: CodigoAbtSchema,
  litrosAbastecidos: z.number().positive(),
  precoUnitario: z.number().positive(),
  medidorLeitura: z.number().min(0),
  fotoPainelUrl: z.string().url().optional(),
  fotoBombaUrl: z.string().url().optional(),
});
export type ConfirmarFrentista = z.infer<typeof ConfirmarFrentistaSchema>;

export const ConfirmarMotoristaSchema = z
  .object({
    autorizacaoId: z.string().uuid().optional(),
    codigoAbt: CodigoAbtSchema.optional(),
  })
  .refine((data) => Boolean(data.autorizacaoId || data.codigoAbt), {
    message: 'Informe o código ABT ou o identificador da autorização',
  });
export type ConfirmarMotorista = z.infer<typeof ConfirmarMotoristaSchema>;

-- ==============================================================================
-- GestFrota — Migração 0001_initial_schema.sql
-- Sistema de Gestão de Combustível e Frota Municipal
-- PostgreSQL 17+ com btree_gist e pgcrypto
-- ==============================================================================

-- 1. Extensões Obrigatórias
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Domínios e Tipos Enumerados
DO $$ BEGIN
    CREATE TYPE tipo_combustivel AS ENUM (
        'GASOLINA_COMUM', 'GASOLINA_ADITIVADA', 'ETANOL', 
        'DIESEL_S10', 'DIESEL_S500', 'GNV', 'ARLA_32'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_medidor AS ENUM ('HODOMETRO', 'HORIMETRO', 'NENHUM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_veiculo AS ENUM ('PROPRIO', 'LOCADO', 'CEDIDO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_autorizacao AS ENUM (
        'PENDENTE', 'RESERVADA', 'CONFIRMADA_FRENTISTA', 
        'CONFIRMADA_BILATERAL', 'EXPIRADA', 'CANCELADA'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_movimento_cota AS ENUM ('RESERVA', 'CONSUMO', 'LIBERACAO', 'ESTORNO', 'AJUSTE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE origem_cota AS ENUM ('ORDINARIA', 'EXTRAORDINARIA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE papel_usuario AS ENUM (
        'GESTOR_GERAL', 'GESTOR_SECRETARIA', 'FISCAL_CONTRATO', 
        'CONTROLE_INTERNO', 'MOTORISTA', 'FRENTISTA', 'ADMIN_GERAL'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE status_fechamento AS ENUM (
        'ABERTO', 'EM_CONCILIACAO', 'CONCILIADO', 'ATESTADO', 'LIQUIDADO'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Função de Contexto do Tenant (RLS Multiente - D-18)
CREATE OR REPLACE FUNCTION app_current_ente_id() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_ente_id', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Módulo Organização
CREATE TABLE IF NOT EXISTS entes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE, -- D-09: CNPJ alfanumérico
    brasao_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parametros_ente (
    ente_id UUID PRIMARY KEY REFERENCES entes(id) ON DELETE RESTRICT,
    validade_autorizacao_minutos INT NOT NULL DEFAULT 60,
    intervalo_minimo_abastecimento_minutos INT NOT NULL DEFAULT 120,
    modo_controle_empenho TEXT NOT NULL DEFAULT 'BLOQUEIO_RIGIDO',
    politica_acumulo_cota TEXT NOT NULL DEFAULT 'NAO_ACUMULA', -- D-23
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unidades_gestoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    codigo TEXT NOT NULL,
    nome TEXT NOT NULL,
    cnpj TEXT NOT NULL, -- D-22: Unidade com CNPJ próprio para empenho (Saúde, Educação)
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, codigo)
);

CREATE TABLE IF NOT EXISTS secretarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    unidade_gestora_id UUID NOT NULL REFERENCES unidades_gestoras(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    sigla TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, sigla)
);

-- 5. Módulo Identidade & Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    cpf TEXT NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, cpf)
);

CREATE TABLE IF NOT EXISTS atribuicoes_papel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    papel papel_usuario NOT NULL,
    secretaria_id UUID REFERENCES secretarias(id) ON DELETE RESTRICT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dispositivos_motorista (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    identificador_dispositivo TEXT NOT NULL,
    modelo TEXT,
    ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, identificador_dispositivo)
);

-- 6. Módulo Fornecimento & Contratos (D-02 / D-12)
CREATE TABLE IF NOT EXISTS fornecedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT NOT NULL, -- D-09
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, cnpj)
);

CREATE TABLE IF NOT EXISTS postos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    endereco TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
    numero_contrato TEXT NOT NULL,
    ano INT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    valor_total NUMERIC(15,2) NOT NULL CHECK (valor_total > 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, numero_contrato, ano)
);

CREATE TABLE IF NOT EXISTS contrato_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE RESTRICT,
    produto tipo_combustivel NOT NULL,
    unidade_medida TEXT NOT NULL DEFAULT 'L',
    quantidade_licitada NUMERIC(12,3) NOT NULL CHECK (quantidade_licitada > 0),
    UNIQUE (contrato_id, produto)
);

CREATE TABLE IF NOT EXISTS contrato_precos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_item_id UUID NOT NULL REFERENCES contrato_itens(id) ON DELETE RESTRICT,
    preco_unitario NUMERIC(10,4) NOT NULL CHECK (preco_unitario > 0),
    vigencia_inicio TIMESTAMPTZ NOT NULL,
    vigencia_fim TIMESTAMPTZ,
    numero_termo_aditivo TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empenhos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    unidade_gestora_id UUID NOT NULL REFERENCES unidades_gestoras(id) ON DELETE RESTRICT,
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE RESTRICT,
    numero_empenho TEXT NOT NULL,
    ano INT NOT NULL,
    saldo_empenhado NUMERIC(15,2) NOT NULL CHECK (saldo_empenhado >= 0),
    saldo_disponivel NUMERIC(15,2) NOT NULL CHECK (saldo_disponivel >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, unidade_gestora_id, numero_empenho, ano)
);

-- 7. Módulo Frota & Condutores
CREATE TABLE IF NOT EXISTS veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    secretaria_id UUID NOT NULL REFERENCES secretarias(id) ON DELETE RESTRICT,
    placa TEXT NOT NULL,
    marca_modelo TEXT NOT NULL,
    ano_fabricacao INT NOT NULL,
    tipo tipo_veiculo NOT NULL DEFAULT 'PROPRIO',
    tipo_medidor tipo_medidor NOT NULL DEFAULT 'HODOMETRO',
    capacidade_tanque_litros NUMERIC(8,2) NOT NULL CHECK (capacidade_tanque_litros > 0), -- D-11
    combustivel_padrao tipo_combustivel NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, placa)
);

CREATE TABLE IF NOT EXISTS motoristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    numero_cnh TEXT NOT NULL,
    categoria_cnh TEXT NOT NULL,
    cnh_validade DATE NOT NULL,
    bloqueado BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, usuario_id),
    UNIQUE (ente_id, numero_cnh)
);

-- D-30: Cada período de vínculo é uma linha imutável; unicidade apenas quando vigente
CREATE TABLE IF NOT EXISTS vinculos_motorista_veiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_fim TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_motorista_veiculo_vigente 
ON vinculos_motorista_veiculo (motorista_id, veiculo_id) 
WHERE data_fim IS NULL;

-- 8. Módulo Cotas (O Coração - D-01 / D-23 / D-24)
CREATE TABLE IF NOT EXISTS cotas_secretaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    secretaria_id UUID NOT NULL REFERENCES secretarias(id) ON DELETE RESTRICT,
    competencia_ano INT NOT NULL,
    competencia_mes INT NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
    tipo_combustivel tipo_combustivel NOT NULL,
    limite_litros NUMERIC(12,3) NOT NULL CHECK (limite_litros >= 0),
    saldo_disponivel_litros NUMERIC(12,3) NOT NULL CHECK (saldo_disponivel_litros >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (secretaria_id, competencia_ano, competencia_mes, tipo_combustivel)
);

CREATE TABLE IF NOT EXISTS cotas_veiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    competencia_ano INT NOT NULL,
    competencia_mes INT NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
    tipo_combustivel tipo_combustivel NOT NULL,
    origem origem_cota NOT NULL DEFAULT 'ORDINARIA',
    limite_litros NUMERIC(12,3) NOT NULL CHECK (limite_litros >= 0),
    saldo_disponivel_litros NUMERIC(12,3) NOT NULL,
    saldo_reservado_litros NUMERIC(12,3) NOT NULL DEFAULT 0,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Invariantes estritas de saldo não-negativo (D-01)
    CONSTRAINT chk_cota_saldo_disponivel_positivo CHECK (saldo_disponivel_litros >= 0),
    CONSTRAINT chk_cota_saldo_reservado_positivo CHECK (saldo_reservado_litros >= 0),
    UNIQUE (veiculo_id, competencia_ano, competencia_mes, tipo_combustivel, origem)
);

-- Razão de cotas imutável (D-01)
CREATE TABLE IF NOT EXISTS movimentos_cota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    cota_veiculo_id UUID NOT NULL REFERENCES cotas_veiculo(id) ON DELETE RESTRICT,
    autorizacao_id UUID, -- Referência opcional à autorização
    tipo tipo_movimento_cota NOT NULL,
    litros NUMERIC(12,3) NOT NULL CHECK (litros > 0),
    saldo_anterior NUMERIC(12,3) NOT NULL CHECK (saldo_anterior >= 0),
    saldo_posterior NUMERIC(12,3) NOT NULL CHECK (saldo_posterior >= 0),
    justificativa TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para garantir a imutabilidade absoluta de movimentos_cota
CREATE OR REPLACE FUNCTION trg_impedir_alteracao_movimento_cota() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'A tabela movimentos_cota é estritamente imutável. Modificações ou exclusões são proibidas.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimentos_cota_imutavel
BEFORE UPDATE OR DELETE ON movimentos_cota
FOR EACH ROW EXECUTE FUNCTION trg_impedir_alteracao_movimento_cota();

-- 9. Módulo Abastecimento & Bilateralidade (D-05 / D-06 / D-12)
CREATE TABLE IF NOT EXISTS autorizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    codigo_abt TEXT NOT NULL UNIQUE, -- Formato ABT-AAAA-XXXXXX
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
    posto_id UUID NOT NULL REFERENCES postos(id) ON DELETE RESTRICT,
    contrato_item_id UUID NOT NULL REFERENCES contrato_itens(id) ON DELETE RESTRICT,
    tipo_combustivel tipo_combustivel NOT NULL,
    litros_solicitados NUMERIC(10,3) NOT NULL CHECK (litros_solicitados > 0),
    valor_estimado NUMERIC(12,2) NOT NULL CHECK (valor_estimado >= 0),
    status status_autorizacao NOT NULL DEFAULT 'RESERVADA',
    validade_limite TIMESTAMPTZ NOT NULL,
    -- Instantâneos históricos imutáveis da emissão (D-12)
    instantaneo_secretaria_id UUID NOT NULL,
    instantaneo_unidade_gestora_id UUID NOT NULL,
    instantaneo_preco_unitario NUMERIC(10,4) NOT NULL CHECK (instantaneo_preco_unitario > 0),
    instantaneo_empenho_id UUID,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abastecimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    autorizacao_id UUID NOT NULL UNIQUE REFERENCES autorizacoes(id) ON DELETE RESTRICT,
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    posto_id UUID NOT NULL REFERENCES postos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
    frentista_usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    litros_abastecidos NUMERIC(10,3) NOT NULL CHECK (litros_abastecidos > 0),
    preco_unitario_aplicado NUMERIC(10,4) NOT NULL CHECK (preco_unitario_aplicado > 0),
    valor_total NUMERIC(12,2) NOT NULL CHECK (valor_total > 0),
    medidor_leitura NUMERIC(12,2) NOT NULL CHECK (medidor_leitura >= 0),
    foto_painel_url TEXT,
    foto_bomba_url TEXT,
    confirmado_motorista_em TIMESTAMPTZ, -- Confirmação bilateral
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Módulo Operação & Diário de Bordo (D-13 / D-27: Não sobreposição)
CREATE TABLE IF NOT EXISTS sessoes_uso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
    periodo TSTZRANGE NOT NULL,
    medidor_inicial NUMERIC(12,2) NOT NULL CHECK (medidor_inicial >= 0),
    medidor_final NUMERIC(12,2),
    finalidade TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrições de exclusão temporal imutáveis (D-27)
    CONSTRAINT ex_veiculo_sessao_uso EXCLUDE USING gist (
        veiculo_id WITH =, periodo WITH &&
    ) WHERE (status != 'CANCELADO'),
    CONSTRAINT ex_motorista_sessao_uso EXCLUDE USING gist (
        motorista_id WITH =, periodo WITH &&
    ) WHERE (status != 'CANCELADO')
);

CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
    motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
    periodo TSTZRANGE NOT NULL,
    destino TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMADO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrições de exclusão para agendamentos (D-27)
    CONSTRAINT ex_veiculo_agendamento EXCLUDE USING gist (
        veiculo_id WITH =, periodo WITH &&
    ) WHERE (status != 'CANCELADO'),
    CONSTRAINT ex_motorista_agendamento EXCLUDE USING gist (
        motorista_id WITH =, periodo WITH &&
    ) WHERE (status != 'CANCELADO')
);

-- 11. Módulo Fiscal, Fechamento & Atesto (D-07 / D-08 / D-09 / D-20)
CREATE TABLE IF NOT EXISTS notas_fiscais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    unidade_gestora_id UUID NOT NULL REFERENCES unidades_gestoras(id) ON DELETE RESTRICT,
    posto_id UUID NOT NULL REFERENCES postos(id) ON DELETE RESTRICT,
    chave_acesso VARCHAR(44) NOT NULL UNIQUE, -- D-09: 44 posições alfanuméricas
    numero_nfe TEXT NOT NULL,
    serie TEXT NOT NULL,
    data_emissao TIMESTAMPTZ NOT NULL,
    valor_total NUMERIC(15,2) NOT NULL CHECK (valor_total > 0),
    xml_url TEXT,
    xml_hash_sha256 VARCHAR(64) NOT NULL, -- D-20: SHA-256 obrigatório
    conferida BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abastecimento_nfe (
    abastecimento_id UUID NOT NULL REFERENCES abastecimentos(id) ON DELETE RESTRICT,
    nota_fiscal_id UUID NOT NULL REFERENCES notas_fiscais(id) ON DELETE RESTRICT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (abastecimento_id, nota_fiscal_id)
);

CREATE TABLE IF NOT EXISTS fechamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    unidade_gestora_id UUID NOT NULL REFERENCES unidades_gestoras(id) ON DELETE RESTRICT,
    posto_id UUID NOT NULL REFERENCES postos(id) ON DELETE RESTRICT,
    contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE RESTRICT,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    valor_total NUMERIC(15,2) NOT NULL CHECK (valor_total >= 0),
    total_litros NUMERIC(15,3) NOT NULL CHECK (total_litros >= 0),
    status status_fechamento NOT NULL DEFAULT 'ABERTO',
    atestado_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    atestado_em TIMESTAMPTZ,
    hash_relatorio_liquidacao VARCHAR(64),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_periodo_fechamento_valido CHECK (periodo_fim >= periodo_inicio)
);

-- Bloqueio após o atesto (D-07): Uma vez atestado, não pode ser alterado
CREATE OR REPLACE FUNCTION trg_bloquear_fechamento_atestado() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('ATESTADO', 'LIQUIDADO') AND NEW.status NOT IN ('ATESTADO', 'LIQUIDADO') THEN
        RAISE EXCEPTION 'Fechamento fiscal já foi atestado/liquidado e não permite reversão ou modificação.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fechamentos_bloqueio_atestado
BEFORE UPDATE ON fechamentos
FOR EACH ROW EXECUTE FUNCTION trg_bloquear_fechamento_atestado();

-- 12. Módulo Auditoria Encadeada com SHA-256 e Âncoras Diárias
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,
    ente_id UUID,
    ator_usuario_id UUID,
    ator_papel TEXT,
    entidade TEXT NOT NULL,
    entidade_id UUID,
    acao TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip TEXT,
    hash_anterior TEXT NOT NULL,
    hash_atual TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger de encadeamento criptográfico para Auditoria
CREATE OR REPLACE FUNCTION trg_calcular_hash_auditoria() RETURNS TRIGGER AS $$
DECLARE
    v_ultimo_hash TEXT;
BEGIN
    SELECT hash_atual INTO v_ultimo_hash 
    FROM auditoria 
    ORDER BY id DESC 
    LIMIT 1;

    NEW.hash_anterior := COALESCE(v_ultimo_hash, 'GENESIS_GESTFROTA_2026');
    NEW.hash_atual := encode(
        digest(
            NEW.hash_anterior || '|' ||
            COALESCE(NEW.ente_id::text, '') || '|' ||
            COALESCE(NEW.ator_usuario_id::text, '') || '|' ||
            NEW.entidade || '|' ||
            COALESCE(NEW.entidade_id::text, '') || '|' ||
            NEW.acao || '|' ||
            COALESCE(NEW.dados_novos::text, '') || '|' ||
            to_char(NEW.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.USOF'),
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_encadeamento
BEFORE INSERT ON auditoria
FOR EACH ROW EXECUTE FUNCTION trg_calcular_hash_auditoria();

-- Imutabilidade da tabela de auditoria
CREATE OR REPLACE FUNCTION trg_auditoria_imutavel() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'A trilha de auditoria é rigorosamente imutável.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_proibir_modificacao
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION trg_auditoria_imutavel();

CREATE TABLE IF NOT EXISTS auditoria_ancoras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    data_ancora DATE NOT NULL,
    total_eventos INT NOT NULL CHECK (total_eventos >= 0),
    primeiro_id BIGINT NOT NULL,
    ultimo_id BIGINT NOT NULL,
    hash_raiz_sha256 VARCHAR(64) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ente_id, data_ancora)
);

-- ==============================================================================
-- 13. FUNÇÕES TRANSACIONAIS DO NÚCLEO DE COTAS (D-01)
-- ==============================================================================

-- Função: Reservar Cota (Emissão da Autorização)
CREATE OR REPLACE FUNCTION reservar_cota_veiculo(
    p_autorizacao_id UUID,
    p_veiculo_id UUID,
    p_tipo_combustivel tipo_combustivel,
    p_litros NUMERIC,
    p_ano INT,
    p_mes INT,
    p_ente_id UUID
) RETURNS VOID AS $$
DECLARE
    v_cota RECORD;
    v_litros_necessarios NUMERIC := p_litros;
    v_litros_disponiveis NUMERIC;
    v_litros_a_reservar NUMERIC;
    v_saldo_anterior NUMERIC;
    v_saldo_posterior NUMERIC;
BEGIN
    IF p_litros <= 0 THEN
        RAISE EXCEPTION 'Volume para reserva deve ser maior que zero.';
    END IF;

    -- Bloqueio em ordem fixa estrita: ORDINARIA antes de EXTRAORDINARIA, depois por ID (Princípio 5)
    FOR v_cota IN
        SELECT id, origem, saldo_disponivel_litros, saldo_reservado_litros
        FROM cotas_veiculo
        WHERE veiculo_id = p_veiculo_id
          AND competencia_ano = p_ano
          AND competencia_mes = p_mes
          AND tipo_combustivel = p_tipo_combustivel
          AND ente_id = p_ente_id
        ORDER BY CASE WHEN origem = 'ORDINARIA' THEN 1 ELSE 2 END, id ASC
        FOR UPDATE
    LOOP
        v_litros_disponiveis := v_cota.saldo_disponivel_litros;
        
        IF v_litros_disponiveis > 0 THEN
            v_litros_a_reservar := LEAST(v_litros_disponiveis, v_litros_necessarios);
            v_saldo_anterior := v_litros_disponiveis;
            v_saldo_posterior := v_litros_disponiveis - v_litros_a_reservar;

            -- Atualiza cotas_veiculo
            UPDATE cotas_veiculo
            SET saldo_disponivel_litros = v_saldo_posterior,
                saldo_reservado_litros = saldo_reservado_litros + v_litros_a_reservar,
                atualizado_em = now()
            WHERE id = v_cota.id;

            -- Grava razão imutável
            INSERT INTO movimentos_cota (
                ente_id, cota_veiculo_id, autorizacao_id, tipo, 
                litros, saldo_anterior, saldo_posterior, justificativa
            ) VALUES (
                p_ente_id, v_cota.id, p_autorizacao_id, 'RESERVA', 
                v_litros_a_reservar, v_saldo_anterior, v_saldo_posterior, 
                'Reserva automática para emissão de autorização'
            );

            v_litros_necessarios := v_litros_necessarios - v_litros_a_reservar;
            EXIT WHEN v_litros_necessarios = 0;
        END IF;
    END LOOP;

    IF v_litros_necessarios > 0 THEN
        RAISE EXCEPTION 'Saldo de cota insuficiente para o veículo na competência %/%. Faltam % L.', 
            p_mes, p_ano, v_litros_necessarios;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função: Consumir Cota (Confirmação do Abastecimento)
CREATE OR REPLACE FUNCTION consumir_cota_veiculo(
    p_autorizacao_id UUID,
    p_litros_reais NUMERIC,
    p_ente_id UUID
) RETURNS VOID AS $$
DECLARE
    v_movimento RECORD;
    v_cota RECORD;
    v_litros_reais_restantes NUMERIC := p_litros_reais;
    v_litros_consumo NUMERIC;
    v_sobra_reserva NUMERIC;
BEGIN
    -- Busca as reservas ativas geradas para esta autorização
    FOR v_movimento IN
        SELECT id, cota_veiculo_id, litros
        FROM movimentos_cota
        WHERE autorizacao_id = p_autorizacao_id
          AND tipo = 'RESERVA'
        ORDER BY id ASC
    LOOP
        SELECT id, saldo_disponivel_litros, saldo_reservado_litros
        INTO v_cota
        FROM cotas_veiculo
        WHERE id = v_movimento.cota_veiculo_id
        FOR UPDATE;

        IF v_litros_reais_restantes >= v_movimento.litros THEN
            v_litros_consumo := v_movimento.litros;
            v_sobra_reserva := 0;
        ELSE
            v_litros_consumo := v_litros_reais_restantes;
            v_sobra_reserva := v_movimento.litros - v_litros_consumo;
        END IF;

        -- Consome da reserva
        UPDATE cotas_veiculo
        SET saldo_reservado_litros = saldo_reservado_litros - v_movimento.litros,
            saldo_disponivel_litros = saldo_disponivel_litros + v_sobra_reserva,
            atualizado_em = now()
        WHERE id = v_cota.id;

        -- Grava consumo
        IF v_litros_consumo > 0 THEN
            INSERT INTO movimentos_cota (
                ente_id, cota_veiculo_id, autorizacao_id, tipo,
                litros, saldo_anterior, saldo_posterior, justificativa
            ) VALUES (
                p_ente_id, v_cota.id, p_autorizacao_id, 'CONSUMO',
                v_litros_consumo, v_cota.saldo_disponivel_litros, v_cota.saldo_disponivel_litros,
                'Consumo efetivado pelo abastecimento'
            );
        END IF;

        -- Se sobrou reserva (abasteceu menos que o reservado), libera a sobra
        IF v_sobra_reserva > 0 THEN
            INSERT INTO movimentos_cota (
                ente_id, cota_veiculo_id, autorizacao_id, tipo,
                litros, saldo_anterior, saldo_posterior, justificativa
            ) VALUES (
                p_ente_id, v_cota.id, p_autorizacao_id, 'LIBERACAO',
                v_sobra_reserva, v_cota.saldo_disponivel_litros, v_cota.saldo_disponivel_litros + v_sobra_reserva,
                'Liberação de sobra de reserva não utilizada'
            );
        END IF;

        v_litros_reais_restantes := v_litros_reais_restantes - v_litros_consumo;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função: Liberar Reserva (Expiração ou Cancelamento)
CREATE OR REPLACE FUNCTION liberar_reserva_veiculo(
    p_autorizacao_id UUID,
    p_ente_id UUID,
    p_motivo TEXT
) RETURNS VOID AS $$
DECLARE
    v_movimento RECORD;
    v_cota RECORD;
BEGIN
    FOR v_movimento IN
        SELECT id, cota_veiculo_id, litros
        FROM movimentos_cota
        WHERE autorizacao_id = p_autorizacao_id
          AND tipo = 'RESERVA'
        ORDER BY id ASC
    LOOP
        SELECT id, saldo_disponivel_litros, saldo_reservado_litros
        INTO v_cota
        FROM cotas_veiculo
        WHERE id = v_movimento.cota_veiculo_id
        FOR UPDATE;

        UPDATE cotas_veiculo
        SET saldo_reservado_litros = GREATEST(0, saldo_reservado_litros - v_movimento.litros),
            saldo_disponivel_litros = saldo_disponivel_litros + v_movimento.litros,
            atualizado_em = now()
        WHERE id = v_cota.id;

        INSERT INTO movimentos_cota (
            ente_id, cota_veiculo_id, autorizacao_id, tipo,
            litros, saldo_anterior, saldo_posterior, justificativa
        ) VALUES (
            p_ente_id, v_cota.id, p_autorizacao_id, 'LIBERACAO',
            v_movimento.litros, v_cota.saldo_disponivel_litros, v_cota.saldo_disponivel_litros + v_movimento.litros,
            COALESCE(p_motivo, 'Liberação de reserva por cancelamento ou expiração')
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 14. POLÍTICAS RLS (Row Level Security - D-18)
-- ==============================================================================

ALTER TABLE unidades_gestoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE postos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_motorista_veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotas_secretaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotas_veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentos_cota ENABLE ROW LEVEL SECURITY;
ALTER TABLE autorizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE abastecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_uso ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_ancoras ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
    t text;
    tabelas text[] := ARRAY[
        'unidades_gestoras', 'secretarias', 'usuarios', 'fornecedores', 
        'postos', 'contratos', 'empenhos', 'veiculos', 'motoristas', 
        'vinculos_motorista_veiculo', 'cotas_secretaria', 'cotas_veiculo', 
        'movimentos_cota', 'autorizacoes', 'abastecimentos', 'sessoes_uso', 
        'agendamentos', 'notas_fiscais', 'fechamentos', 'auditoria_ancoras'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        EXECUTE format('DROP POLICY IF EXISTS rls_tenant_isolation ON %I', t);
        EXECUTE format(
            'CREATE POLICY rls_tenant_isolation ON %I ' ||
            'USING (ente_id = app_current_ente_id()) ' ||
            'WITH CHECK (ente_id = app_current_ente_id())',
            t
        );
    END LOOP;
END $$;

-- ==============================================================================
-- GestFrota — Migração 0002_outbox_and_routines.sql
-- Módulos de Comunicação, Outbox Transacional e Suporte ao Worker
-- ==============================================================================

-- 1. Tabela de Outbox Transacional (Princípio 6 da Seção 5.2)
CREATE TABLE IF NOT EXISTS outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID REFERENCES entes(id) ON DELETE CASCADE,
    canal TEXT NOT NULL, -- e.g. 'NOTIFICACAO_MOTORISTA', 'AUDITORIA_EXTERNAL', 'INTEGRACAO_TCE'
    topico TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'PROCESSADO', 'FALHA')),
    tentativas INT NOT NULL DEFAULT 0,
    max_tentativas INT NOT NULL DEFAULT 5,
    erro_ultimo TEXT,
    agendado_para TIMESTAMPTZ NOT NULL DEFAULT now(),
    processado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_pendente 
ON outbox (status, agendado_para) 
WHERE status IN ('PENDENTE', 'FALHA');

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ente_id UUID NOT NULL REFERENCES entes(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'ALERTA', 'MULTA', 'COTA'
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    lida_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario 
ON notificacoes (usuario_id, lida, criado_em DESC);

-- Habilitar RLS
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tenant_isolation ON outbox;
CREATE POLICY rls_tenant_isolation ON outbox 
USING (ente_id IS NULL OR ente_id = app_current_ente_id()) 
WITH CHECK (ente_id IS NULL OR ente_id = app_current_ente_id());

DROP POLICY IF EXISTS rls_tenant_isolation ON notificacoes;
CREATE POLICY rls_tenant_isolation ON notificacoes 
USING (ente_id = app_current_ente_id()) 
WITH CHECK (ente_id = app_current_ente_id());

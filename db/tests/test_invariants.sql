-- ==============================================================================
-- GestFrota — db/tests/test_invariants.sql
-- Bateria de Testes Executáveis das Invariantes de Banco de Dados
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- 1. Setup de Dados de Teste
DO $$
DECLARE
    v_ente_id UUID;
    v_ug_id UUID;
    v_sec_id UUID;
    v_user_motorista_id UUID;
    v_user_frentista_id UUID;
    v_motorista_id UUID;
    v_veiculo_id UUID;
    v_cota_id UUID;
    v_aut_id UUID := gen_random_uuid();
    v_cota RECORD;
    v_erro_disparado BOOLEAN;
BEGIN
    RAISE NOTICE '>>> INICIANDO BATERIA DE TESTES DE INVARIANTES DO GESTFROTA <<<';

    -- 1.1 Criar Ente
    INSERT INTO entes (id, nome, cnpj) 
    VALUES (gen_random_uuid(), 'Município Teste Invariantes', 'TESTE000000100')
    RETURNING id INTO v_ente_id;

    -- Setar contexto RLS para o teste
    PERFORM set_config('app.current_ente_id', v_ente_id::text, true);

    -- 1.2 Unidade Gestora e Secretaria
    INSERT INTO unidades_gestoras (ente_id, codigo, nome, cnpj)
    VALUES (v_ente_id, 'UG01', 'Fundo Municipal de Saúde', 'TESTE000000101')
    RETURNING id INTO v_ug_id;

    INSERT INTO secretarias (ente_id, unidade_gestora_id, nome, sigla)
    VALUES (v_ente_id, v_ug_id, 'Secretaria de Saúde', 'SMS')
    RETURNING id INTO v_sec_id;

    -- 1.3 Usuários e Motorista
    INSERT INTO usuarios (ente_id, cpf, nome, email)
    VALUES (v_ente_id, '111.111.111-11', 'Motorista Teste', 'motorista@teste.gov.br')
    RETURNING id INTO v_user_motorista_id;

    INSERT INTO motoristas (ente_id, usuario_id, numero_cnh, categoria_cnh, cnh_validade)
    VALUES (v_ente_id, v_user_motorista_id, '12345678900', 'D', '2028-12-31')
    RETURNING id INTO v_motorista_id;

    -- 1.4 Veículo
    INSERT INTO veiculos (ente_id, secretaria_id, placa, marca_modelo, ano_fabricacao, tipo, tipo_medidor, capacidade_tanque_litros, combustivel_padrao)
    VALUES (v_ente_id, v_sec_id, 'ABC1D23', 'Ambulância UTI Móvel', 2024, 'PROPRIO', 'HODOMETRO', 70.0, 'DIESEL_S10')
    RETURNING id INTO v_veiculo_id;

    -- ==========================================================================
    -- TESTE 1: INVARIANTE D-01 — Razão de Cotas, Reserva e Consumo
    -- ==========================================================================
    RAISE NOTICE '[TESTE 1] Invariante D-01: Razão de cotas e reserva imutável...';

    -- Criar cota de 100 Litros
    INSERT INTO cotas_veiculo (
        ente_id, veiculo_id, competencia_ano, competencia_mes, 
        tipo_combustivel, origem, limite_litros, saldo_disponivel_litros, saldo_reservado_litros
    ) VALUES (
        v_ente_id, v_veiculo_id, 2026, 11,
        'DIESEL_S10', 'ORDINARIA', 100.0, 100.0, 0.0
    ) RETURNING id INTO v_cota_id;

    -- 1.1 Reservar 40 Litros para a autorização
    PERFORM reservar_cota_veiculo(v_aut_id, v_veiculo_id, 'DIESEL_S10', 40.0, 2026, 11, v_ente_id);

    SELECT * INTO v_cota FROM cotas_veiculo WHERE id = v_cota_id;
    ASSERT v_cota.saldo_disponivel_litros = 60.0, 'FALHA: Saldo disponível deveria ser 60.0 L após reserva de 40 L';
    ASSERT v_cota.saldo_reservado_litros = 40.0, 'FALHA: Saldo reservado deveria ser 40.0 L';

    -- 1.2 Tentar reservar 70 L (deve falhar pois só restam 60 L disponíveis)
    v_erro_disparado := FALSE;
    BEGIN
        PERFORM reservar_cota_veiculo(gen_random_uuid(), v_veiculo_id, 'DIESEL_S10', 70.0, 2026, 11, v_ente_id);
    EXCEPTION WHEN OTHERS THEN
        v_erro_disparado := TRUE;
    END;
    ASSERT v_erro_disparado = TRUE, 'FALHA: O banco deveria ter rejeitado reserva superior ao saldo disponível!';

    -- 1.3 Consumir 35 Litros dos 40 L reservados (sobra de 5 L devolvida ao disponível)
    PERFORM consumir_cota_veiculo(v_aut_id, 35.0, v_ente_id);

    SELECT * INTO v_cota FROM cotas_veiculo WHERE id = v_cota_id;
    ASSERT v_cota.saldo_disponivel_litros = 65.0, 'FALHA: Saldo disponível deveria voltar para 65.0 L (60 + 5 sobra)';
    ASSERT v_cota.saldo_reservado_litros = 0.0, 'FALHA: Saldo reservado deveria zerar após o consumo integral da reserva';

    -- 1.4 Testar Imutabilidade de movimentos_cota
    v_erro_disparado := FALSE;
    BEGIN
        UPDATE movimentos_cota SET litros = 999 WHERE cota_veiculo_id = v_cota_id;
    EXCEPTION WHEN OTHERS THEN
        v_erro_disparado := TRUE;
    END;
    ASSERT v_erro_disparado = TRUE, 'FALHA: movimentos_cota deve ser estritamente imutável (UPDATE rejeitado)!';

    RAISE NOTICE '✓ Teste 1 (Invariante D-01) aprovado com sucesso.';

    -- ==========================================================================
    -- TESTE 2: INVARIANTE D-27 — Restrições de Exclusão (Sobreposição Temporal)
    -- ==========================================================================
    RAISE NOTICE '[TESTE 2] Invariante D-27: Restrições de exclusão temporal (EXCLUDE USING gist)...';

    -- Agendamento 1: 10:00 às 12:00
    INSERT INTO agendamentos (ente_id, veiculo_id, motorista_id, periodo, destino, status)
    VALUES (
        v_ente_id, v_veiculo_id, v_motorista_id,
        tstzrange('2026-11-25 10:00:00+00', '2026-11-25 12:00:00+00', '[)'),
        'Hospital Regional', 'CONFIRMADO'
    );

    -- Tentativa de Agendamento 2 conflitante: 11:00 às 13:00 no mesmo veículo
    v_erro_disparado := FALSE;
    BEGIN
        INSERT INTO agendamentos (ente_id, veiculo_id, motorista_id, periodo, destino, status)
        VALUES (
            v_ente_id, v_veiculo_id, v_motorista_id,
            tstzrange('2026-11-25 11:00:00+00', '2026-11-25 13:00:00+00', '[)'),
            'Posto de Saúde B', 'CONFIRMADO'
        );
    EXCEPTION WHEN check_violation OR exclusion_violation THEN
        v_erro_disparado := TRUE;
    END;
    ASSERT v_erro_disparado = TRUE, 'FALHA: O banco deveria ter rejeitado sobreposição temporal de agendamento do veículo!';

    RAISE NOTICE '✓ Teste 2 (Invariante D-27) aprovado com sucesso.';

    -- ==========================================================================
    -- TESTE 3: AUDITORIA ENCADEADA COM SHA-256
    -- ==========================================================================
    RAISE NOTICE '[TESTE 3] Auditoria Encadeada com SHA-256 e Imutabilidade...';

    INSERT INTO auditoria (ente_id, entidade, acao, dados_novos, hash_anterior, hash_atual)
    VALUES (v_ente_id, 'veiculos', 'CRIACAO', '{"placa": "ABC1D23"}'::jsonb, '', '');

    INSERT INTO auditoria (ente_id, entidade, acao, dados_novos, hash_anterior, hash_atual)
    VALUES (v_ente_id, 'cotas_veiculo', 'RESERVA', '{"litros": 40}'::jsonb, '', '');

    -- Verificar que o hash_anterior do segundo evento é igual ao hash_atual do primeiro evento
    DO $audit_check$
    DECLARE
        v_hash1 TEXT;
        v_hash2_prev TEXT;
    BEGIN
        SELECT hash_atual INTO v_hash1 FROM auditoria ORDER BY id ASC LIMIT 1;
        SELECT hash_anterior INTO v_hash2_prev FROM auditoria ORDER BY id DESC LIMIT 1;
        ASSERT v_hash1 = v_hash2_prev, 'FALHA: Encadeamento criptográfico de auditoria quebrado!';
    END $audit_check$;

    -- Tentar atualizar auditoria (deve ser rejeitado)
    v_erro_disparado := FALSE;
    BEGIN
        UPDATE auditoria SET acao = 'FRAUDE' WHERE ente_id = v_ente_id;
    EXCEPTION WHEN OTHERS THEN
        v_erro_disparado := TRUE;
    END;
    ASSERT v_erro_disparado = TRUE, 'FALHA: A tabela de auditoria deve ser rigorosamente imutável!';

    RAISE NOTICE '✓ Teste 3 (Auditoria Encadeada) aprovado com sucesso.';

    -- ==========================================================================
    -- TESTE 4: INVARIANTE D-30 — Unicidade de Vínculos Vigentes
    -- ==========================================================================
    RAISE NOTICE '[TESTE 4] Invariante D-30: Vínculos com unicidade apenas vigente...';

    INSERT INTO vinculos_motorista_veiculo (ente_id, motorista_id, veiculo_id, data_inicio, data_fim)
    VALUES (v_ente_id, v_motorista_id, v_veiculo_id, now() - interval '10 days', now() - interval '5 days');

    INSERT INTO vinculos_motorista_veiculo (ente_id, motorista_id, veiculo_id, data_inicio, data_fim)
    VALUES (v_ente_id, v_motorista_id, v_veiculo_id, now(), NULL);

    -- Tentativa de segundo vínculo ativo simultâneo
    v_erro_disparado := FALSE;
    BEGIN
        INSERT INTO vinculos_motorista_veiculo (ente_id, motorista_id, veiculo_id, data_inicio, data_fim)
        VALUES (v_ente_id, v_motorista_id, v_veiculo_id, now(), NULL);
    EXCEPTION WHEN unique_violation THEN
        v_erro_disparado := TRUE;
    END;
    ASSERT v_erro_disparado = TRUE, 'FALHA: O banco deveria proibir mais de um vínculo vigente simultâneo!';

    RAISE NOTICE '✓ Teste 4 (Invariante D-30) aprovado com sucesso.';

    RAISE NOTICE '>>> TODOS OS TESTES DE INVARIANTES DO BANCO FORAM APROVADOS COM SUCESSO! <<<';
END $$;

ROLLBACK; -- Desfaz alterações do teste

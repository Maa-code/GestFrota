-- ==============================================================================
-- GestFrota — db/seeds/0001_demo_seed.sql
-- Dados iniciais para demonstração e testes da API
-- ==============================================================================

DO $$
DECLARE
    v_ente_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
    v_ug_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
    v_sec_id UUID := '33333333-3333-3333-3333-333333333333'::UUID;
    
    v_user_admin_id UUID := '44444444-4444-4444-4444-444444444441'::UUID;
    v_user_motorista_id UUID := '44444444-4444-4444-4444-444444444442'::UUID;
    v_user_frentista_id UUID := '44444444-4444-4444-4444-444444444443'::UUID;

    v_user_demo_admin_id UUID := '44444444-4444-4444-4444-444444444451'::UUID;
    v_user_demo_mot_id UUID := '44444444-4444-4444-4444-444444444452'::UUID;
    v_user_demo_frent_id UUID := '44444444-4444-4444-4444-444444444453'::UUID;
    
    v_motorista_id UUID := '55555555-5555-5555-5555-555555555555'::UUID;
    v_motorista_demo_id UUID := '55555555-5555-5555-5555-555555555556'::UUID;
    v_veiculo_id UUID := '66666666-6666-6666-6666-666666666666'::UUID;
    
    v_fornecedor_id UUID := '77777777-7777-7777-7777-777777777777'::UUID;
    v_posto_id UUID := '88888888-8888-8888-8888-888888888888'::UUID;
    v_contrato_id UUID := '99999999-9999-9999-9999-999999999999'::UUID;
    v_item_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID;
    
    v_ano INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_mes INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
BEGIN
    -- 1. Ente
    INSERT INTO entes (id, nome, cnpj, timezone)
    VALUES (v_ente_id, 'Prefeitura Municipal de Exemplo', '12ABC345000199', 'America/Sao_Paulo')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO parametros_ente (ente_id, validade_autorizacao_minutos, intervalo_minimo_abastecimento_minutos)
    VALUES (v_ente_id, 60, 120)
    ON CONFLICT (ente_id) DO NOTHING;

    -- 2. Unidade Gestora e Secretaria
    INSERT INTO unidades_gestoras (id, ente_id, codigo, nome, cnpj)
    VALUES (v_ug_id, v_ente_id, 'FMS-01', 'Fundo Municipal de Saúde', '12ABC345000288')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO secretarias (id, ente_id, unidade_gestora_id, nome, sigla)
    VALUES (v_sec_id, v_ente_id, v_ug_id, 'Secretaria Municipal de Saúde', 'SMS')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Usuários do Sistema
    -- Gestor Geral
    INSERT INTO usuarios (id, ente_id, cpf, nome, email, telefone)
    VALUES (v_user_admin_id, v_ente_id, '000.111.222-33', 'Carlos Gestor', 'admin@gestfrota.gov.br', '83999991111')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO atribuicoes_papel (usuario_id, ente_id, papel)
    VALUES (v_user_admin_id, v_ente_id, 'GESTOR_GERAL')
    ON CONFLICT DO NOTHING;

    -- Motorista
    INSERT INTO usuarios (id, ente_id, cpf, nome, email, telefone)
    VALUES (v_user_motorista_id, v_ente_id, '444.555.666-77', 'Marcos Motorista', 'carlos.motorista@gestfrota.gov.br', '83999992222')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO atribuicoes_papel (usuario_id, ente_id, papel, secretaria_id)
    VALUES (v_user_motorista_id, v_ente_id, 'MOTORISTA', v_sec_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO motoristas (id, ente_id, usuario_id, numero_cnh, categoria_cnh, cnh_validade)
    VALUES (v_motorista_id, v_ente_id, v_user_motorista_id, '98765432100', 'D', '2028-12-31')
    ON CONFLICT (id) DO NOTHING;

    -- Frentista
    INSERT INTO usuarios (id, ente_id, cpf, nome, email, telefone)
    VALUES (v_user_frentista_id, v_ente_id, '888.999.000-11', 'João Frentista', 'joao.posto@gestfrota.gov.br', '83999993333')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO atribuicoes_papel (usuario_id, ente_id, papel)
    VALUES (v_user_frentista_id, v_ente_id, 'FRENTISTA')
    ON CONFLICT DO NOTHING;

    -- Usuários Demo Rápidos (demo.gov.br)
    -- Admin Demo
    INSERT INTO usuarios (id, ente_id, cpf, nome, email, telefone)
    VALUES (v_user_demo_admin_id, v_ente_id, '000.111.222-44', 'Admin Demo', 'admin@demo.gov.br', '83999994444')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO atribuicoes_papel (usuario_id, ente_id, papel)
    VALUES (v_user_demo_admin_id, v_ente_id, 'GESTOR_GERAL')
    ON CONFLICT DO NOTHING;

    -- Motorista Demo
    INSERT INTO usuarios (id, ente_id, cpf, nome, email, telefone)
    VALUES (v_user_demo_mot_id, v_ente_id, '444.555.666-88', 'João Silva Motorista', 'motorista@demo.gov.br', '83999995555')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO atribuicoes_papel (usuario_id, ente_id, papel, secretaria_id)
    VALUES (v_user_demo_mot_id, v_ente_id, 'MOTORISTA', v_sec_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO motoristas (id, ente_id, usuario_id, numero_cnh, categoria_cnh, cnh_validade)
    VALUES (v_motorista_demo_id, v_ente_id, v_user_demo_mot_id, '12345678900', 'D', '2029-12-31')
    ON CONFLICT (id) DO NOTHING;

    -- Frentista Demo
    INSERT INTO usuarios (id, ente_id, cpf, nome, email, telefone)
    VALUES (v_user_demo_frent_id, v_ente_id, '888.999.000-22', 'Lucas Frentista Demo', 'frentista@demo.gov.br', '83999996666')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO atribuicoes_papel (usuario_id, ente_id, papel)
    VALUES (v_user_demo_frent_id, v_ente_id, 'FRENTISTA')
    ON CONFLICT DO NOTHING;

    -- 4. Veículo
    INSERT INTO veiculos (
        id, ente_id, secretaria_id, placa, marca_modelo, ano_fabricacao,
        tipo, tipo_medidor, capacidade_tanque_litros, combustivel_padrao
    ) VALUES (
        v_veiculo_id, v_ente_id, v_sec_id, 'BRA2E19', 'Van Ambulância Master', 2024,
        'PROPRIO', 'HODOMETRO', 80.0, 'DIESEL_S10'
    ) ON CONFLICT (id) DO NOTHING;

    -- Vínculo motorista-veículo vigente (D-30)
    INSERT INTO vinculos_motorista_veiculo (ente_id, motorista_id, veiculo_id, data_inicio)
    VALUES (v_ente_id, v_motorista_id, v_veiculo_id, now())
    ON CONFLICT DO NOTHING;

    -- 5. Fornecedor, Posto e Contrato
    INSERT INTO fornecedores (id, ente_id, razao_social, nome_fantasia, cnpj)
    VALUES (v_fornecedor_id, v_ente_id, 'Auto Posto Alvorada Ltda', 'Posto Alvorada', '98ZYX765000111')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO postos (id, ente_id, fornecedor_id, nome, cnpj, endereco)
    VALUES (v_posto_id, v_ente_id, v_fornecedor_id, 'Posto Alvorada Matriz', '98ZYX765000111', 'Av. Epitácio Pessoa, 1000 - Centro')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO contratos (id, ente_id, fornecedor_id, numero_contrato, ano, data_inicio, data_fim, valor_total)
    VALUES (v_contrato_id, v_ente_id, v_fornecedor_id, '042', v_ano, CURRENT_DATE - 30, CURRENT_DATE + 335, 500000.00)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO contrato_itens (id, contrato_id, produto, unidade_medida, quantidade_licitada)
    VALUES (v_item_id, v_contrato_id, 'DIESEL_S10', 'L', 100000.00)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO contrato_precos (contrato_item_id, preco_unitario, vigencia_inicio)
    VALUES (v_item_id, 5.8900, now() - interval '30 days')
    ON CONFLICT DO NOTHING;

    -- 6. Cotas do Veículo para a competência atual
    INSERT INTO cotas_veiculo (
        ente_id, veiculo_id, competencia_ano, competencia_mes,
        tipo_combustivel, origem, limite_litros, saldo_disponivel_litros, saldo_reservado_litros
    ) VALUES (
        v_ente_id, v_veiculo_id, v_ano, v_mes,
        'DIESEL_S10', 'ORDINARIA', 500.0, 500.0, 0.0
    ) ON CONFLICT (veiculo_id, competencia_ano, competencia_mes, tipo_combustivel, origem) DO UPDATE
    SET saldo_disponivel_litros = 500.0, saldo_reservado_litros = 0.0;

    RAISE NOTICE 'Seed inicial de demonstração inserido com sucesso!';
END $$;

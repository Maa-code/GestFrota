# GestFrota — Sistema de Gestão de Combustível e Frota Municipal

Sistema SaaS multiente para controle do ciclo completo do combustível da frota municipal, da cota ao atesto para pagamento, diário de bordo e integridade com dados isolados por município e trilha de auditoria encadeada com SHA-256.

## 🚀 Arquitetura (Monólito Modular com Monorepo pnpm)

O projeto segue a especificação técnica formal (novembro/2026), com TypeScript de ponta a ponta sobre PostgreSQL 17+:

```
/apps
  /api          Fastify: módulos de domínio, rotas, BFF, RLS e autenticação
  /worker       pg-boss: rotinas assíncronas, PDF, OCR, outbox e integrações
  /campo        PWA do motorista e frentista (offline com Dexie IndexedDB)
  /gestao       Painel web administrativo, contratos, frotas e integridade
/packages
  /contratos    Contratos Zod compartilhados e tipos (OpenAPI 3.1)
  /dominio      Regras puras de negócio, máquinas de estado, validação NT 2026.004
  /ui           Design system, tokens e componentes acessíveis
  /pdf          Modelos de relatórios e comprovantes com Playwright
/db
  /migrations   Migrações SQL versionadas (0001_*.sql)
  /tests        Testes executáveis de banco e invariantes críticas
  /seeds        Dados iniciais de catálogos e demonstração
/infra          Dockerfiles, docker-compose.yml e scripts de infraestrutura
/docs           Documentação técnica, proposta e ADRs
```

## 🔒 Invariantes Críticas Garantidas pelo Banco

1. **Razão de Cotas Imutável (D-01):** Movimentações de reserva, consumo e estorno com `CHECK (saldo >= 0)` e ordenação estrita de bloqueio de linhas (`SELECT FOR UPDATE`).
2. **Isolamento Multiente RLS (D-18):** Row Level Security com injeção de contexto de sessão (`app.current_ente_id`).
3. **Auditoria Encadeada com SHA-256:** Tabela imutável de eventos com encadeamento criptográfico e âncoras diárias.
4. **Restrições de Exclusão (D-27):** `EXCLUDE USING gist` para impedir sobreposição temporal de viagens ou uso do mesmo veículo/motorista.
5. **NF-e e CNPJ Alfanumérico (D-09):** Compatível com a IN RFB 2.229/2024 e NT 2026.004 (Módulo 11 ASCII - 48).

## 🛠️ Como Iniciar o Ambiente Local

### Pré-requisitos:
* Docker Desktop & Docker Compose
* Node.js >= 20.x (LTS)
* pnpm >= 9.x

### Passo a passo:
```bash
# 1. Subir o PostgreSQL 17 (configurado na porta 5433 para evitar conflitos locais no Windows)
pnpm docker:up

# 2. Rodar as migrações SQL e popular o banco com a semente de demonstração
pnpm db:migrate
pnpm db:seed

# 3. Executar os testes de invariantes do banco e pacotes
pnpm db:test
pnpm test
```

### Inicializando os Aplicativos:

```bash
# Terminal 1: Backend Fastify API (porta 3000 com documentação OpenAPI Swagger em /docs)
pnpm --filter @gestfrota/api dev

# Terminal 2: Worker Assíncrono pg-boss (expiração de autorizações, renovação mensal de cotas, âncoras SHA-256 e outbox)
pnpm --filter @gestfrota/worker dev

# Terminal 3: Painel Web de Gestão (porta 5173 - React 19 + Tailwind CSS v4)
pnpm --filter @gestfrota/gestao dev

# Terminal 4: PWA de Campo (porta 5174 - Motoristas e Frentistas com suporte Offline Dexie)
pnpm --filter @gestfrota/campo dev
```

---

## 👥 Credenciais de Demonstração (Seed)

| Papel | E-mail | Senha | Aplicação |
|---|---|---|---|
| **Administrador Geral** | `admin@demo.gov.br` | `SenhaForte123!` | Painel de Gestão (`:5173`) |
| **Condutor / Motorista** | `motorista@demo.gov.br` | `SenhaForte123!` | PWA de Campo (`:5174`) |
| **Frentista de Posto** | `frentista@demo.gov.br` | `SenhaForte123!` | PWA de Campo (`:5174`) |

---

## 📱 PWA de Campo (`apps/campo`)

O aplicativo de campo foi desenvolvido como PWA (Progressive Web App) com capacidade offline nativa:
- **Fluxo do Motorista:**
  - Solicitação de abastecimento com geração de código alfanumérico em alto contraste `ABT-AAAA-XXXXXX` (estritamente sem QR Code, conforme Seção 2).
  - Confirmação bilateral presencial (D-05 / D-06).
  - Credencial funcional com aviso expresso de que "NÃO substitui a CNH" (D-31).
- **Fluxo do Frentista:**
  - Validação de código ABT com exibição de placa, tipo de combustível e limite de preço contratado (D-02).
  - Registro de abastecimento na bomba com travas de capacidade máxima do tanque (D-11) e leitura do hodômetro/horímetro.
- **Resiliência Offline:**
  - Armazenamento em fila local com Dexie (IndexedDB) quando sem sinal de celular.
  - Sincronização automática em background ao restabelecer conectividade de rede.
  - Modal de confirmação obrigatório antes de encerrar sessão (Logout seguro).

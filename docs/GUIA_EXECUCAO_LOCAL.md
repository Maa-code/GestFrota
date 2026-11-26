# 🚀 Guia Prático de Execução Local — GestFrota

Este documento fornece as instruções completas, passo a passo, para inicializar, operar e solucionar eventuais problemas do **GestFrota** na sua máquina local de desenvolvimento.

---

## 📋 1. Pré-Requisitos do Ambiente

Antes de iniciar os serviços, certifique-se de que sua máquina possui os seguintes softwares instalados e operacionais:

| Software | Versão Recomendada | Verificação no Terminal |
|---|---|---|
| **Node.js** | `>= 20.x` (LTS ou v24) | `node -v` |
| **pnpm** | `>= 9.x` ou `12.x` | `pnpm -v` |
| **Docker Desktop** | Versão atual com suporte a WSL2 | Ícone da baleia verde na barra de tarefas |
| **Git** | Qualquer versão moderna | `git --version` |

> [!IMPORTANT]
> **Atenção à Porta do Banco de Dados:**  
> O GestFrota está intencionalmente configurado para expor o PostgreSQL na porta do host **`5433`** (`5433:5432`).  
> Isso evita conflitos com serviços locais do PostgreSQL frequentemente instalados no Windows (como OSGeo4W, QGIS ou servidores locais que ocupam a porta 5432). Não altere para 5432.

---

## 🐳 2. Inicializando o Banco de Dados (PostgreSQL 17)

Abra um terminal PowerShell na pasta raiz do projeto (`D:\GestFrota`):

```powershell
cd D:\GestFrota
```

### 2.1. Subir o container Docker
Certifique-se de que o **Docker Desktop** está aberto e com o motor em execução (luz verde "Engine running" no rodapé do Docker Desktop). Em seguida, execute:

```powershell
pnpm docker:up
```

*Tempo esperado:* 2 a 5 segundos (ou até 1 minuto se for o primeiro download da imagem `postgres:17-alpine`).

Para verificar se o container subiu com saúde:
```powershell
docker ps
```
*Deve listar o container `gestfrota-postgres` com status `Up (healthy)` apontando para a porta `0.0.0.0:5433->5432/tcp`.*

---

## 🗄️ 3. Aplicando Esquema, Migrações e Dados de Teste

Com o banco de dados ativo, aplique as tabelas, regras de negócio e a semente com os dados de demonstração:

```powershell
# 1. Aplica as migrações SQL (tabelas, RLS, triggers imutáveis, funções atômicas de cota)
pnpm db:migrate

# 2. Popula o banco com os dados iniciais (Prefeitura, SMS, contratos, veículo e usuários)
pnpm db:seed
```

---

## 🧪 4. Validação por Testes Automatizados (Opcional, mas Recomendado)

Para comprovar que todas as 24 invariantes críticas e regras de negócio estão em conformidade com a especificação técnica:

```powershell
# Executa todos os testes do monorepo (Contratos, Domínio, API Fastify, Worker e Banco)
pnpm test
```

Também é possível executar baterias isoladas:
* `pnpm db:test` — Invariantes de integridade e razão imutável (D-01, D-18, D-27)
* `pnpm --filter @gestfrota/contratos test` — Validações Zod (CNPJ NT 2026.004, chave NF-e, código ABT)
* `pnpm --filter @gestfrota/dominio test` — Regras de hodômetro e trava física de tanque (D-11)
* `pnpm --filter @gestfrota/api test` — Ciclo completo E2E de abastecimento e sessões HttpOnly
* `pnpm --filter @gestfrota/worker test` — Rotinas de expiração, renovação de cotas e selos SHA-256

---

## 🖥️ 5. Inicializando as Aplicações e Serviços

### ⚡ Opção Rápida (1 Clique — Recomendada)
Você pode subir o banco PostgreSQL (caso ainda não esteja ativo) e **todos os 4 módulos simultaneamente em uma única janela** dando um duplo clique no arquivo **`iniciar-gestfrota.bat`** na pasta raiz (`D:\GestFrota\iniciar-gestfrota.bat`) ou executando no terminal:

```powershell
pnpm dev
```

*(Para encerrar todos os serviços juntos, basta pressionar `Ctrl + C` nessa janela.)*

---

### 🧩 Opção Manual (4 Terminais Separados)
Se preferir acompanhar os logs de cada serviço em abas separadas do Windows Terminal, abra **4 terminais** posicionados em `D:\GestFrota`:

```mermaid
flowchart TD
    subgraph Host ["Máquina Local"]
        DB[("PostgreSQL 17\nPorta 5433")]
        API["Fastify API\nPorta 3000"]
        WORKER["Worker pg-boss\nBackground"]
        GESTAO["Gestão Web React\nPorta 5173"]
        CAMPO["PWA de Campo React\nPorta 5174"]
    end
    
    API --> DB
    WORKER --> DB
    GESTAO -->|REST /api| API
    CAMPO -->|REST /api + Offline Dexie| API
```

### 💻 Terminal 1 — Backend Fastify API:
```powershell
pnpm --filter @gestfrota/api dev
```
* **URL da API:** [http://localhost:3000](http://localhost:3000)
* **Documentação Swagger (OpenAPI 3.1):** [http://localhost:3000/docs](http://localhost:3000/docs)

### ⚙️ Terminal 2 — Worker Assíncrono (`pg-boss`):
```powershell
pnpm --filter @gestfrota/worker dev
```
* Executa as rotinas de fila transacional, expiração de reservas vencidas em 60 min, renovação mensal de cotas e selamento das âncoras diárias SHA-256.

### 🏢 Terminal 3 — Painel Web de Gestão Administrativa:
```powershell
pnpm --filter @gestfrota/gestao dev
```
* **URL:** [http://localhost:5173](http://localhost:5173)
* **Acesso do Gestor Geral:** `admin@demo.gov.br` | Senha: `SenhaForte123!`

### 📱 Terminal 4 — PWA de Campo (Motoristas e Frentistas):
```powershell
pnpm --filter @gestfrota/campo dev
```
* **URL:** [http://localhost:5174](http://localhost:5174)
* *(Dica: Pressione `F12` no navegador e ative a visão responsiva mobile para simular a tela do smartphone).*
* **Atalho Motorista:** `motorista@demo.gov.br` | Senha: `SenhaForte123!`
* **Atalho Frentista:** `frentista@demo.gov.br` | Senha: `SenhaForte123!`

---

## 🛠️ 6. Resolução de Problemas Frequentes (Troubleshooting)

### Problema A: `pnpm docker:up` fica congelado sem devolver o prompt
* **Causa:** O Docker Desktop no Windows estava iniciando ou pausado quando o comando foi disparado. O processo do terminal fica preso esperando resposta no socket.
* **Solução:**
  1. Pressione `Ctrl + C` no terminal para cancelar o comando preso.
  2. Olhe para a janela do Docker Desktop e verifique se o canto inferior esquerdo está com a luz **verde** ("Engine running").
  3. Quando estiver verde, execute `pnpm docker:up` novamente.

### Problema B: `open //./pipe/dockerDesktopLinuxEngine: O sistema não pode encontrar o arquivo especificado`
* **Causa:** O aplicativo Docker Desktop está totalmente fechado no Windows.
* **Solução:** Abra o Docker Desktop pelo Menu Iniciar do Windows e aguarde ficar verde antes de rodar os comandos do Docker.

### Problema C: Falha de autenticação ao conectar no PostgreSQL (`autenticação do tipo senha falhou`)
* **Causa:** A aplicação tentou se conectar à porta `5432` em vez de `5433`, atingindo um PostgreSQL local já instalado no Windows.
* **Solução:** Verifique o arquivo `.env` da raiz e confirme que a string de conexão é `postgresql://postgres:postgres@localhost:5433/gestfrota_dev`.

### Problema D: Como reiniciar o banco limpo do zero
Se você quiser limpar todos os dados de testes e redefinir o banco original:
```powershell
# 1. Derruba o container e o volume
pnpm docker:down -v

# 2. Sobe novamente
pnpm docker:up

# 3. Reaplica o esquema e os dados iniciais
pnpm db:migrate
pnpm db:seed
```

---

## 📌 7. Tabela Resumo de Portas e Acessos

| Aplicação / Serviço | Endereço | Descrição |
|---|---|---|
| **Painel de Gestão** | `http://localhost:5173` | Interface Web para Administradores e Frotistas |
| **PWA de Campo** | `http://localhost:5174` | Aplicativo móvel para Motoristas e Frentistas |
| **API Backend** | `http://localhost:3000` | Endpoints REST, RLS e autenticação |
| **Swagger OpenAPI** | `http://localhost:3000/docs` | Documentação interativa de todos os endpoints |
| **PostgreSQL 17** | `localhost:5433` | Banco de dados transacional com RLS e imutabilidade |

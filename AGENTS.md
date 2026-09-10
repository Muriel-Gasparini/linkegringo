# AGENTS.md — Manual Técnico & Diretrizes Arquiteturais do LinkeGringo

Este documento contém o manual operacional, as decisões arquiteturais e as diretrizes inegociáveis para agentes de inteligência artificial (Claude, Codex, Gemini, GPT, Antigravity e outros) que inspecionarem, mantiverem ou evoluírem o **LinkeGringo**.

---

## 1. Princípios & Regras de Ouro Inegociáveis

1. **100% Client-Side (Zero Backend / BYOK)**:
   - Este projeto **NUNCA** deve introduzir um servidor backend proprietário (Node/Express/Fastify/Go/Python) para intermediar requisições entre o usuário e as APIs de IA.
   - Toda lógica de negócio, orquestração de IA, processamento multimodal e armazenamento roda diretamente no navegador do usuário (`apps/web`) ou via MCP Server local em stdio (`packages/mcp`).
   - O modelo é estritamente **Bring Your Own Key (BYOK)**. A Gemini API Key do usuário permanece exclusivamente no `localStorage` do navegador ou em variáveis de ambiente da máquina local.

2. **Prevenção Absoluta de Vazamento de Segredos (Secrets) & PII**:
   - **NUNCA** commitar chaves de API, credenciais ou tokens em arquivos de código, testes, fixtures ou documentação.
   - O arquivo `.gitignore` bloqueia arquivos de ambiente (`.env*`) e certificados.
   - É estritamente proibido trafegar PII (dados pessoais, e-mails, transcrições) em ferramentas externas ou telemetria.

3. **Arquitetura Modular em Camadas**:
   - `packages/core`: Tipos de domínio, schemas Zod, normalizadores, utilitários de busca/inbound e interface `AiProvider`. Sem dependências de React ou do DOM.
   - `packages/ai`: Implementações concretas de `AiProvider` (`GeminiAiProvider`, `DemoAiProvider`), factory/registry, prompts procedurais e schemas de saída estruturados.
   - `packages/mcp`: Servidor Model Context Protocol oficial (`@linkegringo/mcp`) para expor ferramentas do LinkeGringo a agentes de IA locais (Google Antigravity, Claude Desktop, Cursor AI, Codex) e integração com o Chrome DevTools Protocol (CDP).
   - `apps/web`: Interface SPA em React 19 + Vite + Tailwind CSS v4. Consome `@linkegringo/core` e `@linkegringo/ai`.

4. **Higiene de Repositório Open Source**:
   - Não commitar arquivos temporários, rascunhos ou anotações de marcos (ex: `m1`, `m2`, `TODO.md`, `notes.md`).
   - Utilize exclusivamente **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`.

---

## 2. Pipeline de IA & Memória Conversacional (`packages/ai`)

1. **Upload Multimodal Direto (PDF Nativo)**:
   - O PDF fornecido pelo usuário é enviado diretamente em base64 (`inlineData: { mimeType: 'application/pdf', data: base64 }`) para a API do Gemini.
   - Não utilize parsers de texto legados (`unpdf`, `pdf-parse`) que quebram layouts e colunas.

2. **Diagnóstico Unificado em 1 Turno (`parseAndDiagnose`)**:
   - A extração estruturada do perfil (`Profile`) e a avaliação inicial (`ProfileReview` com `triageBottlenecks` e `primaryGaps`) ocorrem em uma única chamada inicial ao Gemini.

3. **Memória de Sessão Contínua (`ai.chats.create`)**:
   - O Gemini mantém a sessão conversacional com o PDF carregado na primeira chamada.
   - As etapas seguintes (`generateInterview`, `evaluateProgress`, `generateRewrittenProfile`) devem utilizar a mesma sessão via `chat.sendMessage()`, preservando o contexto completo sem retransmissão redundante de tokens.
   - O histórico da sessão deve ser serializado e restaurado via `getChatHistory()` e `restoreChatHistory()` para sobreviver ao refresh da página (F5) no cliente.

4. **Resiliência e Fallback de Modelos**:
   - O provedor implementa contingência transparente em caso de indisponibilidade transitória ou cota excedida (503/429), alternando para modelos de contingência sem corromper o histórico do chat.

---

## 3. Engenharia de Prompts & Invariantes Algorítmicos

1. **Zero Schemas no Texto do Prompt**:
   - **NUNCA** inclua definições de JSON Schema ou interfaces TypeScript no texto do prompt. O schema deve ser fornecido exclusivamente através do parâmetro `responseSchema` do SDK da IA para garantir saídas estruturadas sem desperdício de tokens.

2. **CoT Procedural em 4 Fases**:
   - Os prompts estruturam o raciocínio procedural em 4 fases:
     1. *Physical Inventory & Count $N$*: Contagem exata do número $N$ de empresas e experiências no documento.
     2. *Spatial Separation & Column Stitching*: Separação de barras laterais da cronologia principal e costura de quebras de página.
     3. *Deterministic Rubric Deduction*: Dedução de pontuação matemática a partir de 100 baseada estritamente em evidências factuais.
     4. *Output Invariant Check*: Validação de saída assertiva.

3. **Garantias Inegociáveis de Não-Regressão**:
   - **Invariante $N \to N$**: O número e os nomes das empresas originais devem ser estritamente preservados no perfil reescrito. Nenhuma empresa pode ser deletada ou omitida. Caso a IA omita alguma empresa, o provedor deve recuperá-la programaticamente.
   - **Monotonicidade de Pontuação**: As pontuações pós-reescrita e pós-intervenção devem ser estritamente maiores ou iguais às notas iniciais ($\text{Scores}_{\text{final}} \ge \text{Scores}_{\text{initial}}$).

4. **Tratamento de Experiências Esparsas (Sparse Experiences)**:
   - Experiências originais com $\le 2$ bullets são sinalizadas automaticamente por `detectSparseExperiences()`.
   - A entrevista foca em obter escopo técnico dessas experiências, e a reescrita é instruída a expandi-las para 3 a 5 bullets densos e fundamentados.

---

## 4. Reverse Engineering de ATS do LinkedIn & Padrões de Reescrita

O objetivo do LinkeGringo é converter buscas e visualizações de recrutadores internacionais em InMails qualificados:

1. **Peso de Indexação 3x**:
   - A Headline e os Títulos de Cargos possuem peso de busca até 3 vezes maior do que o corpo do perfil nos algoritmos do LinkedIn Recruiter.
2. **Headline de Alta Conversão ($\le 160$ caracteres)**:
   - Estrutura recomendada: `[Role Anchor] | [3-4 Core Techs] | [System Scale / Impact] | [US Remote / Seniority]`.
   - Evitar termos vagos ("Passionate", "Aspiring", "Open to Opportunities").
3. **Resumo About Orientado a Leitura Rápida (F-Shape)**:
   - Gancho forte (*hook*) nos primeiros 250 caracteres, visível antes do botão "...ver mais".
   - Parágrafos curtos, escopo de arquitetura e especialização técnica.
4. **100% Bullets Google XYZ**:
   - Formato obrigatório: `Accomplished [X], measured by [Y], by doing [Z]`.
   - Sempre ancorar métricas de engenharia (latência, throughput, custo, escala, SLA).
5. **Open to Work Alinhado**:
   - Recomendar 5 títulos padronizados de alta liquidez no mercado norte-americano.

---

## 5. Model Context Protocol (MCP) & Chrome DevTools Hub (`packages/mcp`)

O pacote `@linkegringo/mcp` expõe ferramentas locais do LinkeGringo e integração com o Google Chrome:

1. **Zero Chaves de API / O Próprio Agente Conectado é a Inteligência**:
   - O servidor MCP **NÃO** consome chave de API do Gemini nem de nenhum provedor externo.
   - O modelo do próprio agente de IA que consome o MCP (Claude 3.7, Antigravity/Gemini, Cursor/GPT-4o, Goose) é o cérebro que executa a cognição, raciocínio e síntese.
   - As ferramentas do `@linkegringo/mcp` atuam como especialistas determinísticos: calculam deduções de ATS, validam métricas Google XYZ, formatam headlines $\le 160$ caracteres e inspecionam o browser via CDP.

2. **Ferramentas MCP Disponíveis**:
   - `audit_profile`: Executa diagnóstico Inbound (0-100), gargalos e lacunas técnicas de forma determinística a partir de PDF ou texto.
   - `simulate_recruiter_search`: Avalia match booleano e semântico com peso 3x em Headline/Skills.
   - `convert_to_xyz_bullet`: Transforma bullets comuns na fórmula oficial do Google XYZ.
   - `generate_headline_proposals`: Gera 3 opções de headline calibradas $\le 160$ caracteres.
   - `check_chrome_cdp_status`: Testa porta de depuração do Chrome (9222) e lista abas do LinkeGringo.

3. **Fluxo Chrome DevTools MCP (Chrome M144+)**:
   - Os usuários ativam a depuração remota visualmente em `chrome://inspect/#remote-debugging` sem necessidade de reiniciar o navegador pelo terminal.
   - Integração com `chrome-devtools-mcp@latest --autoConnect` solicita autorização nativa de sessão ao usuário via pop-up seguro.

---

## 6. Telemetria Privacy-First Client-Side (`apps/web/src/lib/telemetry.ts`)

1. **Centralização e Tipagem Estrita**:
   - Todos os eventos devem estar tipados em `TelemetryEventMap`.
   - Disparar eventos exclusivamente através de `track(event, payload)`.
2. **Métricas Numéricas & Agregadas**:
   - Priorizar propriedades numéricas (`durationSeconds`, `inboundScore`, `scoreDelta`, contagens de bullets, taxas de conclusão) que permitam agregações analíticas no Umami Cloud.
   - Manter bandas ordinais complementares (`scoreBand: 'low' | 'mid' | 'high'`, `durationBand: 'fast' | 'normal' | 'slow'`) para funis.
3. **Zero PII & Sanitização Compulsória**:
   - **NUNCA** trafegar nos payloads: textos brutos de currículo, respostas de entrevista, fatos técnicos, chaves de API, e-mails ou nomes.
   - Todas as chamadas a `track()` passam pela sanitização preventiva.
4. **Monitoramento Operacional de Erros de IA (`api_error`)**:
   - Registrar falhas usando `track('api_error', { stage, errorType })`.
   - Categorizar com `categorizeApiError(err)` (`'quota_exceeded' | 'invalid_key' | 'model_overloaded' | 'network' | 'unknown'`).
   - **NUNCA** logar o erro cru ou rastros de pilha que contenham prompts.

---

## 7. Comandos de Validação Obrigatórios

Sempre execute e valide estes comandos antes de concluir qualquer alteração ou submeter commits:

```bash
# Instalação de dependências
pnpm install

# Checagem estática de tipos em todos os pacotes (0 erros)
pnpm -r typecheck

# Suíte completa de testes automatizados (100% verde)
pnpm -r test

# Build de produção do aplicativo web
pnpm --filter @linkegringo/web build
```

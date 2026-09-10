import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  auditProfileInputSchema,
  handleAuditProfile,
} from './tools/audit-profile.js';
import {
  handleSimulateRecruiterSearch,
  simulateRecruiterSearchInputSchema,
} from './tools/recruiter-simulator.js';
import {
  convertToXyzBulletInputSchema,
  handleConvertToXyzBullet,
} from './tools/xyz-bullet-converter.js';
import {
  generateHeadlineInputSchema,
  handleGenerateHeadline,
} from './tools/headline-generator.js';
import {
  checkChromeCdpInputSchema,
  handleCheckChromeCdp,
} from './tools/cdp-check.js';

export function createLinkeGringoMcpServer(): McpServer {
  const server = new McpServer({
    name: 'linkegringo-mcp',
    version: '1.0.0',
  });

  // 1. audit_profile
  server.registerTool(
    'audit_profile',
    {
      description:
        'Audita um perfil de LinkedIn (via caminho de PDF, base64 ou texto) contra os critérios de contratação de empresas tech dos EUA. Retorna nota Inbound (0-100), gargalos de triagem de recrutadores e lacunas de stack.',
      inputSchema: auditProfileInputSchema.shape,
    },
    async (args) => {
      return await handleAuditProfile(args);
    },
  );

  // 2. simulate_recruiter_search
  server.registerTool(
    'simulate_recruiter_search',
    {
      description:
        'Simula buscas booleanas e algoritmos do LinkedIn Recruiter ATS. Avalia a presença de palavras-chave com peso 3x em Headline/Skills e peso 1x em experiências, calculando a probabilidade de indexação.',
      inputSchema: simulateRecruiterSearchInputSchema.shape,
    },
    async (args) => {
      return await handleSimulateRecruiterSearch(args);
    },
  );

  // 3. convert_to_xyz_bullet
  server.registerTool(
    'convert_to_xyz_bullet',
    {
      description:
        'Transforma descrições genéricas de atividades em bullets de alto impacto seguindo a fórmula oficial do Google: Accomplished [X], measured by [Y], by doing [Z].',
      inputSchema: convertToXyzBulletInputSchema.shape,
    },
    async (args) => {
      return await handleConvertToXyzBullet(args);
    },
  );

  // 4. generate_headline_proposals
  server.registerTool(
    'generate_headline_proposals',
    {
      description:
        'Gera propostas de Headline (título) no LinkedIn com até 160 caracteres, calibradas para visualização sem cortes no Desktop e Mobile e alta indexação de busca por recrutadores gringos.',
      inputSchema: generateHeadlineInputSchema.shape,
    },
    async (args) => {
      return await handleGenerateHeadline(args);
    },
  );

  // 5. check_chrome_cdp_status
  server.registerTool(
    'check_chrome_cdp_status',
    {
      description:
        'Verifica se o Google Chrome está com a depuração remota (CDP) ativada (via chrome://inspect/#remote-debugging ou porta 9222) e lista as abas disponíveis, verificando se o LinkeGringo está aberto.',
      inputSchema: checkChromeCdpInputSchema.shape,
    },
    async (args) => {
      return await handleCheckChromeCdp(args);
    },
  );

  // Recurso Educativo: Guia de Boas Práticas do LinkeGringo
  server.registerResource(
    'guidelines',
    'linkegringo://guidelines',
    {
      title: 'Diretrizes Oficiais do LinkeGringo para Vagas nos EUA',
      description:
        'Princípios fundamentais: fórmula Google XYZ, headlines de até 160 caracteres, eliminação de red flags culturais brasileiras e maximização de Inbound Readiness.',
      mimeType: 'text/markdown',
    },
    async () => {
      return {
        contents: [
          {
            uri: 'linkegringo://guidelines',
            text: `
# Diretrizes Oficiais LinkeGringo: Otimização de Perfil para Recrutadores dos EUA

1. **Headline $\le$ 160 caracteres**:
   - Formato recomendado: \`[Cargo Específico] | [3-4 Tecnologias Core] | [Escala/Domínio] | US Remote\`
   - Evite slogans vagos ("Apaixonado por tecnologia", "Resolvendo problemas complexos").
   - Headline tem peso 3x no algoritmo de busca do LinkedIn Recruiter.

2. **Fórmula Google XYZ para Experiências**:
   - Toda conquista deve responder: *"Accomplished [X], measured by [Y], by doing [Z]"*.
   - Exemplo: *"Architected distributed event-driven payment service in Go, reducing p99 latency by 42% and scaling to 15,000 requests/sec."*

3. **Incentivo a Inbound (Ser Descoberto)**:
   - Recrutadores usam filtros booleanos estritos. Se "Senior Software Engineer" e "Go" não estiverem no título da experiência atual ou na headline, você não entra no funil inicial.
   - Elimine red flags de localização restrita e declare disponibilidade para contratos internacionais (W-8BEN / PJ Internacional / B2B).
`.trim(),
          },
        ],
      };
    },
  );

  return server;
}

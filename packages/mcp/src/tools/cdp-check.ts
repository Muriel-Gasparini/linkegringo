import { z } from 'zod';
import { checkChromeCdp } from '../cdp/probe.js';

export const checkChromeCdpInputSchema = z.object({
  port: z
    .number()
    .default(9222)
    .describe('Porta do Chrome DevTools Protocol a ser testada (padrão 9222)'),
  host: z
    .string()
    .default('127.0.0.1')
    .describe('Host do Chrome (padrão 127.0.0.1)'),
  timeoutMs: z
    .number()
    .default(5000)
    .describe('Tempo limite em milissegundos para a conexão'),
});

export type CheckChromeCdpInput = z.infer<typeof checkChromeCdpInputSchema>;

export async function handleCheckChromeCdp(input: CheckChromeCdpInput) {
  const status = await checkChromeCdp(input.port, input.host, input.timeoutMs);

  const session = status.sessionState;
  const isProfileLoaded = Boolean(session?.hasUploadedProfile);

  let sessionSection = '';
  if (status.linkeGringoTabFound) {
    if (isProfileLoaded) {
      sessionSection = `
### 👤 Sessão do LinkeGringo: 🟢 Perfil Carregado
- **Candidato**: ${session?.candidateName || 'Identificado'}
- **Cargo Alvo**: ${session?.targetRole || 'Não especificado'}
- **Passo Atual**: \`${session?.step || 'diagnostic'}\`
- **Inbound Score**: ${session?.inboundScore !== undefined ? `${session.inboundScore}/100` : 'Pronto para cálculo'}

> 💡 **Instrução para a IA**: O perfil do usuário já está carregado. Você pode utilizar diretamente as ferramentas \`audit_profile\`, \`simulate_recruiter_search\`, \`generate_headline_proposals\` e \`convert_to_xyz_bullet\` com os dados do candidato.
`;
    } else {
      sessionSection = `
### 👤 Sessão do LinkeGringo: 🟡 Aguardando Upload do PDF
- **Passo Atual**: \`upload\` (Tela inicial)
- **Status do Arquivo**: Nenhum PDF do LinkedIn foi carregado ainda pelo usuário.

> 💡 **Instrução para a IA**: O usuário está com o LinkeGringo aberto, mas ainda não subiu o PDF. **Peça educadamente para o usuário arrastar ou selecionar o PDF do seu perfil do LinkedIn no dropzone da aplicação web** (${status.linkeGringoTabUrl || 'http://localhost:5173'}). Assim que o usuário subir o PDF, você terá acesso instantâneo aos dados para auditar e otimizar!
`;
    }
  } else {
    sessionSection = `
### 🌐 Sessão do LinkeGringo: ⚠️ Não Detectada
> O LinkeGringo não foi detectado em nenhuma aba aberta. Peça ao usuário para abrir \`http://localhost:5173\` no navegador ou fornecer o texto do perfil diretamente.
`;
  }

  const markdownSummary = `
# Status do Chrome Remote Debugging (CDP) & LinkeGringo

**Porta CDP**: ${status.host}:${status.port}
**Status do Chrome**: ${status.isRunning ? '🟢 Conectado e Ativo' : '🔴 Desconectado'}

${
  status.isRunning
    ? `
- **Versão do Navegador**: ${status.browser || 'Google Chrome'}
- **Aba do LinkeGringo**: ${
        status.linkeGringoTabFound
          ? `✓ Detectada (\`${status.linkeGringoTabUrl}\`)`
          : '⚠️ Nenhuma aba do LinkeGringo aberta'
      }

### 🛡️ Privacy Shield Ativo
- **Abas Pessoais Protegidas**: ${status.otherTabsCount} aba(s) abertas no navegador foram preservadas sem inspeção (e-mails, mensageiros, documentos).
- **Escopo Restrito**: O LinkeGringo acessa exclusivamente abas pertencentes à própria aplicação LinkeGringo.

${sessionSection}
`
    : `
> ❌ **Motivo**: ${status.error || 'Porta fechada.'}
> 
> **Como ativar no Google Chrome (M144+)**:
> 1. Abra uma nova aba e acesse: \`chrome://inspect/#remote-debugging\`
> 2. Marque a opção para **Ativar depuração remota**.
> 3. Se estiver usando o servidor oficial DevTools MCP, configure com \`--autoConnect\`.
`
}
`.trim();

  return {
    content: [
      {
        type: 'text' as const,
        text: markdownSummary,
      },
    ],
    structuredData: status,
  };
}

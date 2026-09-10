import { z } from 'zod';
import { termMatchesText } from '@linkegringo/core';

export const simulateRecruiterSearchInputSchema = z.object({
  headline: z.string().describe('Headline atual ou proposta do candidato'),
  summary: z.string().default('').describe('Resumo ou seção About do perfil'),
  skills: z.array(z.string()).default([]).describe('Lista de competências técnicas registradas'),
  experienceBullets: z
    .array(z.string())
    .default([])
    .describe('Bullets das experiências profissionais'),
  targetRole: z
    .string()
    .default('Senior Software Engineer')
    .describe('Cargo-alvo da busca (ex: Senior Backend Engineer)'),
  requiredKeywords: z
    .array(z.string())
    .optional()
    .describe('Termos técnicos ou palavras-chave obrigatórias a testar (ex: ["Go", "Kubernetes", "Microservices"])'),
});

export type SimulateRecruiterSearchInput = z.infer<
  typeof simulateRecruiterSearchInputSchema
>;

export async function handleSimulateRecruiterSearch(
  input: SimulateRecruiterSearchInput,
) {
  const defaultKeywords = input.requiredKeywords?.length
    ? input.requiredKeywords
    : [input.targetRole, 'Senior', 'Remote', 'Architecture', 'Scale'];

  const highPriorityText = `${input.headline} ${input.skills.join(' ')}`;
  const bodyText = `${input.summary} ${input.experienceBullets.join(' ')}`;

  const evaluations = defaultKeywords.map((term) => {
    const inHighPriority = termMatchesText(highPriorityText, term);
    const inBody = termMatchesText(bodyText, term);

    let status: 'match' | 'weak' | 'missing' = 'missing';
    let detail = 'Termo não encontrado no perfil.';

    if (inHighPriority) {
      status = 'match';
      detail = 'Posicionado em local de peso 3x (Headline ou Top Skills).';
    } else if (inBody) {
      status = 'weak';
      detail = 'Presente apenas no corpo do perfil ou bullets secundários.';
    }

    return {
      term,
      status,
      detail,
    };
  });

  const matchCount = evaluations.filter((e) => e.status === 'match').length;
  const weakCount = evaluations.filter((e) => e.status === 'weak').length;
  const missingCount = evaluations.filter((e) => e.status === 'missing').length;
  const total = evaluations.length || 1;

  const matchPercentage = Math.round(
    ((matchCount * 1.0 + weakCount * 0.5) / total) * 100,
  );

  const overallStatus: 'match' | 'weak' | 'missing' =
    matchPercentage >= 80 ? 'match' : matchPercentage >= 40 ? 'weak' : 'missing';

  const markdownSummary = `
# Simulação de Busca do Recrutador (LinkedIn Recruiter ATS)

**Cargo Buscado**: ${input.targetRole}
**Compatibilidade com a Busca**: **${matchPercentage}%** (${overallStatus === 'match' ? '🟢 Alta Visibilidade' : overallStatus === 'weak' ? '🟡 Visibilidade Parcial' : '🔴 Fora do Radar'})
**Resumo de Termos**: ${matchCount} com Match Direto (3x), ${weakCount} Fracos, ${missingCount} Faltantes.

## 🔍 Análise de Termos-Chave
${evaluations
  .map(
    (e) =>
      `- ${e.status === 'match' ? '✓ 🟢' : e.status === 'weak' ? '⚠️ 🟡' : '❌ 🔴'} **${e.term}**: ${e.detail}`,
  )
  .join('\n')}

${
  missingCount > 0
    ? `\n> 💡 **Dica do Recrutador**: Adicione os termos faltantes diretamente na sua Headline ou na seção de Competências para triplicar a chance de indexação.`
    : '\n> 🏆 **Excelente**: Seu perfil tem densidade perfeita para capturar filtros booleanos de recrutadores dos EUA.'
}
`.trim();

  return {
    content: [
      {
        type: 'text' as const,
        text: markdownSummary,
      },
    ],
    structuredData: {
      overallStatus,
      matchPercentage,
      evaluations,
      matchCount,
      weakCount,
      missingCount,
    },
  };
}

import { z } from 'zod';

export const generateHeadlineInputSchema = z.object({
  targetRole: z
    .string()
    .default('Senior Software Engineer')
    .describe('Cargo pretendido em inglês (ex: Staff Distributed Systems Engineer)'),
  coreTechnologies: z
    .array(z.string())
    .min(1)
    .max(5)
    .default(['TypeScript', 'React', 'Node.js'])
    .describe('3 a 4 tecnologias centrais e mais procuradas da sua stack'),
  keyDifferentiator: z
    .string()
    .optional()
    .describe('Diferencial ou escopo técnico (ex: High Scale, Fintech, Cloud Architecture)'),
  seniorityOrScope: z
    .string()
    .default('US Remote')
    .describe('Senioridade ou disponibilidade (ex: US Remote, Global Teams, Staff)'),
});

export type GenerateHeadlineInput = z.infer<typeof generateHeadlineInputSchema>;

export async function handleGenerateHeadline(input: GenerateHeadlineInput) {
  const techsStr = input.coreTechnologies.slice(0, 4).join(' • ');
  const diffStr = input.keyDifferentiator || 'Distributed Systems';
  const scopeStr = input.seniorityOrScope || 'US Remote';

  const option1 = `${input.targetRole} | ${techsStr} | ${diffStr} | ${scopeStr}`;
  const option2 = `${input.targetRole} | Scaling ${diffStr} with ${techsStr} | ${scopeStr}`;
  const option3 = `${input.targetRole} | ${input.coreTechnologies.slice(0, 3).join(', ')} Specialist | ${scopeStr}`;

  const proposals = [
    {
      type: 'Niche Specialist (Recomendada)',
      headline: option1.length > 160 ? option1.slice(0, 157) + '...' : option1,
      charCount: option1.length,
      focus: 'Densidade máxima de palavras-chave para o algoritmo do LinkedIn Recruiter (peso 3x).',
    },
    {
      type: 'Scale & Impact Oriented',
      headline: option2.length > 160 ? option2.slice(0, 157) + '...' : option2,
      charCount: option2.length,
      focus: 'Comunica maturidade arquitetural e foco em resolução de problemas de negócio.',
    },
    {
      type: 'Direct & Concise',
      headline: option3.length > 160 ? option3.slice(0, 157) + '...' : option3,
      charCount: option3.length,
      focus: 'Fórmula limpa ideal para visualização completa no app mobile do LinkedIn.',
    },
  ];

  const markdownSummary = `
# Propostas de Headline de Alta Conversão

**Cargo-Alvo**: ${input.targetRole}

${proposals
  .map(
    (p, i) => `
### Opção ${i + 1}: ${p.type}
> ✨ **"${p.headline}"**
- **Caracteres**: ${p.charCount} / 160 ${p.charCount <= 160 ? '✓ (Dentro do limite recomendado)' : '⚠️ (Excedeu 160)'}
- **Vantagem**: ${p.focus}
`,
  )
  .join('\n')}

> 💡 **Regra de Ouro**: Mantenha sempre abaixo de 160 caracteres para garantir que os recrutadores leiam o cargo e as tecnologias inteiras tanto no Desktop quanto no Mobile.
`.trim();

  return {
    content: [
      {
        type: 'text' as const,
        text: markdownSummary,
      },
    ],
    structuredData: {
      proposals,
    },
  };
}

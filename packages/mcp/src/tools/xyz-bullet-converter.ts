import { z } from 'zod';

export const convertToXyzBulletInputSchema = z.object({
  rawBullet: z
    .string()
    .describe('Bullet original descritivo ou passivo (ex: "Desenvolvi microsserviços em Go para pagamentos")'),
  roleContext: z
    .string()
    .default('Senior Software Engineer')
    .describe('Contexto da empresa, cargo ou projeto (ex: "Fintech de pagamentos, alta escala")'),
  action: z
    .string()
    .optional()
    .describe('Ação de impacto com verbo no passado (ex: "Architected and deployed distributed payment services")'),
  metric: z
    .string()
    .optional()
    .describe('Métrica quantitativa [Y] (ex: "reducing p99 latency by 35% and scaling to 12,000 RPS")'),
  method: z
    .string()
    .optional()
    .describe('Como foi feito [Z] (ex: "by migrating monolith endpoints to Go microservices on AWS EKS")'),
});

export type ConvertToXyzBulletInput = z.infer<
  typeof convertToXyzBulletInputSchema
>;

export function formatGoogleXyzBullet(parts: {
  action: string;
  metric: string;
  method: string;
}): string {
  const cleanAction = parts.action.trim().replace(/[.,;]+$/, '');
  const cleanMetric = parts.metric.trim().replace(/[.,;]+$/, '');
  const cleanMethod = parts.method.trim().replace(/[.,;]+$/, '');

  const methodPrefix = /^by\s+/i.test(cleanMethod) ? '' : 'by ';
  const metricPrefix = /^measured by\s+/i.test(cleanMetric)
    ? ''
    : /^resulting in\s+/i.test(cleanMetric)
      ? ''
      : 'measured by ';

  return `${cleanAction}, ${metricPrefix}${cleanMetric}, ${methodPrefix}${cleanMethod}.`;
}

export async function handleConvertToXyzBullet(input: ConvertToXyzBulletInput) {
  const raw = input.rawBullet.trim();

  // Se o usuário/agente já forneceu as 3 partes discriminadas
  if (input.action && input.metric && input.method) {
    const formatted = formatGoogleXyzBullet({
      action: input.action,
      metric: input.metric,
      method: input.method,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `
# Bullet Google XYZ Formatado

✨ **${formatted}**

- **[X] Accomplished**: ${input.action}
- **[Y] Measured by**: ${input.metric}
- **[Z] By doing**: ${input.method}
`.trim(),
        },
      ],
      structuredData: {
        formattedBullet: formatted,
        parts: { action: input.action, metric: input.metric, method: input.method },
      },
    };
  }

  // Análise heurística do bullet fornecido
  const metricRegex = /\b(\d+|%|\$|ms|s|k|m|rps|tps|x)\b/i;
  const hasMetrics = metricRegex.test(raw);
  const activeVerbs = [
    'Architected',
    'Engineered',
    'Designed',
    'Spearheaded',
    'Optimized',
    'Scaled',
    'Automated',
    'Refactored',
    'Implemented',
    'Streamlined',
    'Accelerated',
  ];

  // Gera 3 templates recomendados para o Agente de IA usar diretamente
  const cleanBullet = raw.replace(/^[-*•\s]+/, '');
  const optionScale = `Architected and scaled core ${input.roleContext} workflows, measured by reducing p99 latency by 35% and handling 10k+ peak RPS, by redesigning synchronous bottlenecks with distributed message queues.`;
  const optionCost = `Optimized cloud resource utilization and data processing pipelines, measured by reducing AWS infrastructure costs by 28% ($45k/year savings), by implementing intelligent autoscaling and caching layers.`;
  const optionReliability = `Engineered robust automated CI/CD and deployment pipelines for ${input.roleContext}, measured by increasing deployment frequency by 3x and achieving 99.99% system availability, by establishing automated regression testing and canary releases.`;

  const report = `
# Análise de Fórmula Google XYZ

**Bullet Analisado**:
> "${cleanBullet}"

**Status de Auditoria**:
- **Verbo de Ação no Passado**: ${activeVerbs.some((v) => cleanBullet.toLowerCase().startsWith(v.toLowerCase())) ? '✅ Presente' : '⚠️ Recomendado substituir o início por um verbo de forte liderança técnica (ex: Architected, Engineered, Optimized)'}
- **Métrica Quantitativa [Y]**: ${hasMetrics ? '✅ Detectada' : '❌ Não detectada — faltam números, porcentagens, latência ou volume'}

---

## 3 Propostas Prontas de Google XYZ para este Contexto:
1. **Foco em Escala & Performance (Latência/Throughput)**:
   > ✨ "${optionScale}"
2. **Foco em Otimização de Custo & Recursos**:
   > ✨ "${optionCost}"
3. **Foco em Confiabilidade & Qualidade de Engenharia**:
   > ✨ "${optionReliability}"

## 💡 Instruções para o Agente de IA:
Pergunte ao candidato qual métrica real mais se aproxima da sua entrega (${hasMetrics ? 'ou valide os números detectados' : 'ex: % de redução de tempo, volume de requisições ou economia'}). Em seguida, finalize o bullet usando a estrutura:
\`Accomplished [X], measured by [Y], by doing [Z]\`.
`.trim();

  return {
    content: [
      {
        type: 'text' as const,
        text: report,
      },
    ],
    structuredData: {
      hasMetrics,
      rawBullet: cleanBullet,
      proposals: [optionScale, optionCost, optionReliability],
    },
  };
}

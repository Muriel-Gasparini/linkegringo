import { z } from 'zod';
import type { Experience } from '@linkegringo/core';
import { checkChromeCdp } from '../cdp/probe.js';

export interface SparseExperience {
  company: string;
  title: string;
  estimatedBullets: number;
}

export function getExperienceBulletCount(exp: { description?: string; bullets?: string[] }): number {
  if (Array.isArray(exp.bullets) && exp.bullets.length > 0) {
    return exp.bullets.length;
  }
  const desc = exp.description;
  if (!desc || !desc.trim()) return 0;

  const lines = desc.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-*•\u2022\u25E6\u25AA\d+.]/.test(l));
  if (bulletLines.length > 0) return bulletLines.length;

  const sentences = desc.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  return Math.max(lines.length, sentences.length);
}

export function detectSparseExperiences(experiences?: Experience[]): SparseExperience[] {
  if (!experiences || !Array.isArray(experiences)) return [];
  const sparse: SparseExperience[] = [];

  for (const exp of experiences) {
    const company = exp.companyName || (exp as any).company || 'Company';
    const title = exp.title || 'Software Engineer';
    const count = getExperienceBulletCount(exp);

    if (count <= 3) {
      sparse.push({
        company,
        title,
        estimatedBullets: count,
      });
    }
  }

  return sparse;
}

export const auditProfileInputSchema = z.object({
  profileText: z
    .string()
    .optional()
    .describe('Texto bruto extraído do perfil do LinkedIn ou currículo do candidato'),
  headline: z
    .string()
    .optional()
    .describe('Headline / Título atual do LinkedIn (se fornecido isoladamente)'),
  summary: z
    .string()
    .optional()
    .describe('Seção Sobre / About atual (se fornecida isoladamente)'),
  experiences: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        bullets: z.array(z.string()).optional(),
        description: z.string().optional(),
      }),
    )
    .optional()
    .describe('Lista estruturada de experiências profissionais'),
  skills: z
    .array(z.string())
    .optional()
    .describe('Lista de competências / skills declaradas'),
  targetRole: z
    .string()
    .default('Senior Software Engineer')
    .describe('Cargo almejado no mercado norte-americano (ex: Senior Backend Engineer)'),
  targetMarket: z
    .string()
    .default('United States Remote')
    .describe('Mercado e regime de trabalho pretendido'),
});

export type AuditProfileInput = z.infer<typeof auditProfileInputSchema>;

export interface AuditIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'headline' | 'experience' | 'about' | 'skills';
  message: string;
  recommendation: string;
}

export async function handleAuditProfile(input: AuditProfileInput) {
  let headline = input.headline || '';
  let summary = input.summary || '';
  let skills = input.skills || [];
  const rawExperiences = [...(input.experiences || [])];

  // Se nenhum dado foi fornecido, tenta buscar sessão ativa do LinkeGringo no Chrome
  if (!headline && !input.profileText && rawExperiences.length === 0) {
    try {
      const cdp = await checkChromeCdp();
      if (cdp.sessionState?.hasUploadedProfile && cdp.sessionState.profile) {
        const p = cdp.sessionState.profile;
        headline = p.headline || '';
        summary = p.summary || '';
        skills = p.skills || [];
        if (Array.isArray(p.experiences)) {
          for (const exp of p.experiences) {
            rawExperiences.push({
              company: exp.companyName || exp.company || 'Company',
              title: exp.title || 'Engineer',
              bullets: exp.bullets,
              description: exp.description,
            });
          }
        }
      } else if (cdp.linkeGringoTabFound) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `
# ⚠️ Nenhum Perfil Carregado no LinkeGringo

A aplicação **LinkeGringo está aberta no seu navegador** (\`${cdp.linkeGringoTabUrl || 'http://localhost:5173'}\`), mas o **upload do PDF do LinkedIn ainda não foi realizado**.

---

### 💡 Próximo Passo
Por favor, acesse a aba do LinkeGringo no seu navegador e **arraste o PDF do seu perfil do LinkedIn para o dropzone** (ou clique para selecionar o arquivo).

Assim que o upload for processado pela aplicação web, chame o \`audit_profile\` novamente para auditar o perfil real automaticamente!
`.trim(),
            },
          ],
          structuredData: {
            status: 'waiting_for_upload',
            linkeGringoTabUrl: cdp.linkeGringoTabUrl,
            message: 'O usuário ainda não subiu o PDF do LinkedIn na aplicação web.',
            actionRequired: 'upload_pdf',
          },
        };
      } else {
        return {
          content: [
            {
              type: 'text' as const,
              text: `
# ⚠️ Nenhum Perfil Fornecido para Auditoria

Nenhum dado de perfil foi informado e a aplicação LinkeGringo não foi detectada no navegador.

### Como prosseguir:
1. **Pela Web**: Abra o LinkeGringo em \`http://localhost:5173\` no Google Chrome e faça o upload do PDF do seu LinkedIn; OU
2. **Via Parâmetros**: Forneça o texto bruto do perfil no parâmetro \`profileText\` ou informe \`headline\`, \`experiences\` e \`skills\`.
`.trim(),
            },
          ],
          structuredData: {
            status: 'missing_profile',
            message: 'Nenhum perfil fornecido e aplicação LinkeGringo não detectada no navegador.',
            actionRequired: 'provide_input_or_open_web',
          },
        };
      }
    } catch {
      // Continua se falhar o CDP
    }
  }

  // Se apenas profileText foi fornecido, extrai os blocos básicos heurísticos
  if (input.profileText && !headline && rawExperiences.length === 0) {
    const lines = input.profileText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      // Primeira linha provável nome, segunda linha provável headline
      headline = lines[1] || lines[0];
      // Tenta achar trechos com termos chave
      const potentialSkills = lines.filter(
        (l) =>
          l.includes(',') &&
          (l.toLowerCase().includes('react') ||
            l.toLowerCase().includes('typescript') ||
            l.toLowerCase().includes('python') ||
            l.toLowerCase().includes('go') ||
            l.toLowerCase().includes('aws') ||
            l.toLowerCase().includes('docker')),
      );
      if (potentialSkills.length > 0) {
        skills = potentialSkills[0].split(',').map((s) => s.trim());
      }
    }
  }

  // Mapeia para formato do detector de sparse
  const domainExperiences: Experience[] = rawExperiences.map((e) => ({
    companyName: e.company,
    title: e.title,
    bullets: e.bullets,
    description: e.description,
    current: false,
    location: '',
  }));

  // Heurística de deduções da Rubrica LinkeGringo (Inicia em 100)
  let score = 100;
  const issues: AuditIssue[] = [];
  const triageBottlenecks: string[] = [];

  // 1. Auditoria de Headline (Peso 3x no algoritmo de busca)
  if (!headline || headline.length < 5) {
    score -= 25;
    triageBottlenecks.push('Headline ausente ou muito curta: perfil invisível no LinkedIn Recruiter.');
    issues.push({
      severity: 'critical',
      category: 'headline',
      message: 'Headline vazia ou insuficiente.',
      recommendation: `Adicione uma headline no formato: "${input.targetRole} | [3-4 Core Techs] | [Escala/Impacto] | US Remote".`,
    });
  } else {
    if (headline.length > 160) {
      score -= 10;
      issues.push({
        severity: 'warning',
        category: 'headline',
        message: `Headline possui ${headline.length} caracteres, excedendo o limite recomendado de 160.`,
        recommendation: 'Reduza para menos de 160 caracteres para evitar que o LinkedIn corte informações cruciais no app mobile.',
      });
    }

    const lowerHeadline = headline.toLowerCase();
    const fluffWords = ['passionate', 'aspiring', 'open to opportunities', 'looking for', 'rockstar', 'ninja', 'entusiasta'];
    const detectedFluff = fluffWords.filter((w) => lowerHeadline.includes(w));
    if (detectedFluff.length > 0) {
      score -= 10;
      triageBottlenecks.push(`Termos vagos na headline (${detectedFluff.join(', ')}): enfraquece o posicionamento sênior.`);
      issues.push({
        severity: 'warning',
        category: 'headline',
        message: `Headline contém palavras-chave fracas: ${detectedFluff.join(', ')}.`,
        recommendation: 'Substitua termos genéricos por especializações técnicas concretas e métricas de sistema.',
      });
    }

    if (!lowerHeadline.includes('remote') && !lowerHeadline.includes('global') && !lowerHeadline.includes('us')) {
      issues.push({
        severity: 'info',
        category: 'headline',
        message: 'Nenhuma menção explícita a trabalho remoto internacional na headline.',
        recommendation: 'Inclua "US Remote" ou "Global Teams" para facilitar a triagem de recrutadores americanos.',
      });
    }
  }

  // 2. Auditoria de Experiências & Bullets Google XYZ
  const sparseExps = detectSparseExperiences(domainExperiences);
  let totalBullets = 0;
  let bulletsWithMetrics = 0;
  const metricRegex = /\b(\d+|%|\$|ms|s|k|m|rps|tps|x)\b/i;

  for (const exp of rawExperiences) {
    const bullets = exp.bullets || (exp.description ? exp.description.split('\n') : []);
    for (const b of bullets) {
      if (b.trim().length > 10) {
        totalBullets++;
        if (metricRegex.test(b)) {
          bulletsWithMetrics++;
        }
      }
    }
  }

  if (rawExperiences.length > 0) {
    if (sparseExps.length > 0) {
      const deduction = Math.min(25, sparseExps.length * 10);
      score -= deduction;
      triageBottlenecks.push(
        `${sparseExps.length} experiência(s) com poucos detalhes (≤ 3 bullets): faltam evidências de escopo técnico.`,
      );
      issues.push({
        severity: 'critical',
        category: 'experience',
        message: `Experiências esparsas detectadas em: ${sparseExps.map((s) => s.company).join(', ')}.`,
        recommendation: 'Expanda cada experiência com 3 a 5 bullets densos e fundamentados.',
      });
    }

    if (totalBullets > 0) {
      const metricRatio = bulletsWithMetrics / totalBullets;
      if (metricRatio < 0.4) {
        score -= 20;
        triageBottlenecks.push('Falta de mensuração quantitativa (apenas ' + Math.round(metricRatio * 100) + '% dos bullets possuem métricas).');
        issues.push({
          severity: 'critical',
          category: 'experience',
          message: 'Baixa densidade da fórmula Google XYZ.',
          recommendation: 'Converta os bullets para "Accomplished [X], measured by [Y], by doing [Z]" ancorando latência, throughput, custo ou SLA.',
        });
      }
    }
  } else if (input.profileText) {
    // Se foi texto genérico, checagem rápida de números
    const hasNumbers = /\b\d+(%|k|m|ms)?\b/i.test(input.profileText);
    if (!hasNumbers) {
      score -= 15;
      triageBottlenecks.push('Raras evidências numéricas encontradas no texto do currículo.');
    }
  }

  // 3. Auditoria da Seção Sobre (About)
  if (summary) {
    if (summary.length < 100) {
      score -= 10;
      issues.push({
        severity: 'warning',
        category: 'about',
        message: 'Resumo Sobre (About) muito conciso ou incompleto.',
        recommendation: 'Crie um resumo estruturado com um gancho forte nos primeiros 250 caracteres e escopo arquitetural.',
      });
    }
  }

  // Normalização do score
  const finalScore = Math.max(15, Math.min(100, score));

  const markdownSummary = `
# Relatório de Diagnóstico Inbound (LinkeGringo)

**Cargo-Alvo**: ${input.targetRole} (${input.targetMarket})
**Nota Inbound**: **${finalScore} / 100** ${finalScore >= 80 ? '🟢 Recruiter-Ready' : finalScore >= 50 ? '🟡 Competitivo Médio' : '🔴 Crítico / Baixa Indexação'}
**Modo**: 100% Local (Executado pelo seu Agente de IA sem necessidade de Chaves de API)

---

## 🚦 Gargalos Críticos de Triagem (Triage Bottlenecks)
${
  triageBottlenecks.length > 0
    ? triageBottlenecks.map((b) => `- ❌ ${b}`).join('\n')
    : '- ✓ Nenhum gargalo impeditivo encontrado para triagem inicial.'
}

## 📋 Auditoria Seção a Seção
${
  issues.length > 0
    ? issues
        .map(
          (iss) =>
            `- **[${iss.category.toUpperCase()}]** (${iss.severity}): ${iss.message}\n  *Ação recomendada*: ${iss.recommendation}`,
        )
        .join('\n')
    : '- Todas as seções atendem às diretrizes de triagem dos EUA.'
}

## 💡 Próximos Passos para o Agente de IA:
1. Usar a ferramenta \`generate_headline_proposals\` para calibrar a headline em até 160 caracteres.
2. Usar a ferramenta \`convert_to_xyz_bullet\` para reescrever as conquistas passivas no formato do Google (*Accomplished [X], measured by [Y], by doing [Z]*).
3. Conduzir uma breve entrevista técnica sobre as experiências esparsas detectadas para extrair métricas de escala realistas.
`.trim();

  return {
    content: [
      {
        type: 'text' as const,
        text: markdownSummary,
      },
    ],
    structuredData: {
      score: finalScore,
      targetRole: input.targetRole,
      headline,
      totalBullets,
      bulletsWithMetrics,
      sparseExperiences: sparseExps,
      triageBottlenecks,
      issues,
    },
  };
}

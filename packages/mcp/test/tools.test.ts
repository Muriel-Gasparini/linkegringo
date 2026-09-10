import { describe, expect, it, vi } from 'vitest';
import * as probeModule from '../src/cdp/probe.js';
import { handleAuditProfile } from '../src/tools/audit-profile.js';
import { handleSimulateRecruiterSearch } from '../src/tools/recruiter-simulator.js';
import { handleConvertToXyzBullet, formatGoogleXyzBullet } from '../src/tools/xyz-bullet-converter.js';
import { handleGenerateHeadline } from '../src/tools/headline-generator.js';
import { handleCheckChromeCdp } from '../src/tools/cdp-check.js';
import { createLinkeGringoMcpServer } from '../src/server.js';

describe('LinkeGringo MCP Tools Suite', () => {
  it('instantiates McpServer with all registered tools', () => {
    const server = createLinkeGringoMcpServer();
    expect(server).toBeDefined();
    expect((server as any).server).toBeDefined();
  });

  describe('audit_profile', () => {
    it('audits profile text deterministically without external API keys', async () => {
      const sampleText = `
        Lucas Silva
        Senior Backend Engineer
        Experienced in Go, Kubernetes, Microservices and AWS.
        Experience:
        Tech Lead at Fintech XYZ (2020 - Present)
        Engineered distributed transaction processing system handling 10k RPS.
      `;

      const result = await handleAuditProfile({
        profileText: sampleText,
        targetRole: 'Senior Backend Engineer',
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Relatório de Diagnóstico Inbound (LinkeGringo)');
      expect(result.structuredData).toBeDefined();
      expect(result.structuredData.score).toBeGreaterThanOrEqual(15);
      expect(result.structuredData.score).toBeLessThanOrEqual(100);
    });

    it('identifies sparse experiences and calculates rubric deductions', async () => {
      const result = await handleAuditProfile({
        headline: 'Software Engineer',
        experiences: [
          {
            company: 'Startup A',
            title: 'Fullstack Dev',
            bullets: ['Fixed bugs in web app.'],
          },
        ],
        targetRole: 'Senior Fullstack Engineer',
      });

      expect(result.structuredData.sparseExperiences.length).toBe(1);
      expect(result.structuredData.triageBottlenecks.length).toBeGreaterThan(0);
      expect(result.structuredData.score).toBeLessThan(100);
    });

    it('returns actionable waiting_for_upload when called without profile and LinkeGringo is open', async () => {
      vi.spyOn(probeModule, 'checkChromeCdp').mockResolvedValueOnce({
        isRunning: true,
        port: 9222,
        host: '127.0.0.1',
        linkeGringoTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        activeTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        otherTabsCount: 15,
        linkeGringoTabFound: true,
        linkeGringoTabUrl: 'http://localhost:5173/',
        sessionState: {
          hasUploadedProfile: false,
          step: 'upload',
        },
      });

      const result = await handleAuditProfile({});
      expect(result.structuredData.status).toBe('waiting_for_upload');
      expect(result.structuredData.actionRequired).toBe('upload_pdf');
      expect(result.content[0].text).toContain('Nenhum Perfil Carregado no LinkeGringo');
      expect(result.content[0].text).toContain('arraste o PDF do seu perfil do LinkedIn');
    });

    it('automatically uses uploaded profile from browser session when available', async () => {
      vi.spyOn(probeModule, 'checkChromeCdp').mockResolvedValueOnce({
        isRunning: true,
        port: 9222,
        host: '127.0.0.1',
        linkeGringoTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        activeTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        otherTabsCount: 15,
        linkeGringoTabFound: true,
        linkeGringoTabUrl: 'http://localhost:5173/',
        sessionState: {
          hasUploadedProfile: true,
          candidateName: 'Maria Dev',
          targetRole: 'Senior Cloud Engineer',
          step: 'diagnostic',
          inboundScore: 78,
          profile: {
            name: 'Maria Dev',
            headline: 'Senior Cloud Engineer | AWS • Kubernetes • Terraform',
            summary: 'Experienced cloud engineer specialized in platform scalability.',
            skills: ['AWS', 'Kubernetes', 'Terraform', 'Go'],
            experiences: [
              {
                companyName: 'CloudScale Inc',
                title: 'Staff Platform Engineer',
                bullets: [
                  'Accomplished 99.99% uptime, measured by reducing downtime incidents by 50%, by automating multi-region failover.',
                ],
              },
            ],
          },
        },
      });

      const result = await handleAuditProfile({});
      expect(result.content[0].text).toContain('Relatório de Diagnóstico Inbound');
      expect(result.structuredData.score).toBeGreaterThan(50);
      expect(result.structuredData.headline).toContain('Senior Cloud Engineer');
    });
  });

  describe('simulate_recruiter_search', () => {
    it('returns match status and 3x weight when keywords appear in headline and skills', async () => {
      const result = await handleSimulateRecruiterSearch({
        headline: 'Senior Backend Engineer | Go • Kubernetes • Microservices | US Remote',
        skills: ['Go', 'Kubernetes', 'Cloud Architecture'],
        summary: 'Experienced software engineer',
        experienceBullets: ['Built APIs in Go'],
        targetRole: 'Senior Backend Engineer',
        requiredKeywords: ['Go', 'Kubernetes', 'Python'],
      });

      expect(result.content[0].text).toContain('Simulação de Busca do Recrutador');
      expect(result.structuredData.overallStatus).toBeDefined();
      expect(result.structuredData.matchCount).toBeGreaterThanOrEqual(2);
      expect(result.structuredData.missingCount).toBe(1); // Python missing
    });
  });

  describe('convert_to_xyz_bullet', () => {
    it('analyzes passive bullet and generates 3 calibrated Google XYZ proposals', async () => {
      const result = await handleConvertToXyzBullet({
        rawBullet: 'Desenvolvi microsserviços de pagamento usando Go e PostgreSQL',
        roleContext: 'Fintech Pagamentos',
      });

      expect(result.content[0].text).toContain('Análise de Fórmula Google XYZ');
      expect(result.structuredData.proposals).toHaveLength(3);
      for (const p of result.structuredData.proposals) {
        expect(p).toContain('measured by');
        expect(p).toContain('by');
      }
    });

    it('formats explicitly provided X, Y, Z parts into official formula', async () => {
      const result = await handleConvertToXyzBullet({
        rawBullet: 'Original bullet text',
        action: 'Architected and deployed distributed services',
        metric: 'reducing p99 latency by 35%',
        method: 'by redesigning queue architecture',
      });

      expect(result.structuredData.formattedBullet).toBe(
        'Architected and deployed distributed services, measured by reducing p99 latency by 35%, by redesigning queue architecture.',
      );
    });
  });

  describe('generate_headline_proposals', () => {
    it('generates 3 distinct proposals strictly within 160 character limit', async () => {
      const result = await handleGenerateHeadline({
        targetRole: 'Staff Distributed Systems Engineer',
        coreTechnologies: ['Go', 'Kubernetes', 'Kafka', 'AWS'],
        keyDifferentiator: 'Ultra-High Scale Event Streaming',
        seniorityOrScope: 'US Remote / B2B',
      });

      expect(result.structuredData.proposals).toHaveLength(3);
      for (const proposal of result.structuredData.proposals) {
        expect(proposal.headline.length).toBeLessThanOrEqual(160);
        expect(proposal.headline).toContain('Staff Distributed Systems Engineer');
      }
    });
  });

  describe('check_chrome_cdp_status', () => {
    it('formats summary with Privacy Shield and guides user when upload is pending', async () => {
      vi.spyOn(probeModule, 'checkChromeCdp').mockResolvedValueOnce({
        isRunning: true,
        port: 9222,
        host: '127.0.0.1',
        browser: 'Chrome/144.0.0.0',
        protocolVersion: '1.3',
        linkeGringoTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        activeTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        otherTabsCount: 18,
        linkeGringoTabFound: true,
        linkeGringoTabUrl: 'http://localhost:5173/',
        sessionState: {
          hasUploadedProfile: false,
          step: 'upload',
        },
      });

      const result = await handleCheckChromeCdp({ port: 9222, host: '127.0.0.1', timeoutMs: 1000 });
      expect(result.content[0].text).toContain('Privacy Shield Ativo');
      expect(result.content[0].text).toContain('18 aba(s) abertas no navegador foram preservadas');
      expect(result.content[0].text).toContain('Aguardando Upload do PDF');
      expect(result.content[0].text).toContain('arrastar ou selecionar o PDF');
    });

    it('displays loaded candidate info when session has an uploaded profile', async () => {
      vi.spyOn(probeModule, 'checkChromeCdp').mockResolvedValueOnce({
        isRunning: true,
        port: 9222,
        host: '127.0.0.1',
        browser: 'Chrome/144.0.0.0',
        protocolVersion: '1.3',
        linkeGringoTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        activeTabs: [{ id: 'tab-1', title: 'LinkeGringo', url: 'http://localhost:5173/' }],
        otherTabsCount: 10,
        linkeGringoTabFound: true,
        linkeGringoTabUrl: 'http://localhost:5173/',
        sessionState: {
          hasUploadedProfile: true,
          candidateName: 'Carlos Silva',
          targetRole: 'Senior SRE / DevOps',
          step: 'diagnostic',
          inboundScore: 82,
        },
      });

      const result = await handleCheckChromeCdp({ port: 9222, host: '127.0.0.1', timeoutMs: 1000 });
      expect(result.content[0].text).toContain('Perfil Carregado');
      expect(result.content[0].text).toContain('Carlos Silva');
      expect(result.content[0].text).toContain('Senior SRE / DevOps');
      expect(result.content[0].text).toContain('82/100');
    });
  });
});

import type { GapTermKind } from '@linkegringo/core';

/**
 * Client-Side BYOK Privacy-Preserved Telemetry.
 * 
 * Invariant Guarantees:
 * 1. Zero PII, secrets, or profile content sent to any external service.
 *    LinkeGringo never transmits profile contents, interview answers, PDF contents, or API keys.
 * 2. Type-safe Event Map strictly enforced at compile time.
 * 3. Anonymous Umami adapter (window.umami) activated only when configured.
 * 4. Local in-memory session logging capped at 100 entries.
 */

export interface TelemetryEventMap {
  // Funnel: Upload -> Diagnosis
  pdf_uploaded: { source: 'upload' | 'demo'; fileSizeKb?: number; hasTargetRole?: boolean };
  target_role_selected: { roleCategory: string; selectionMethod?: 'quick_pill' | 'custom_input' };
  analysis_started: { source: 'upload' | 'demo'; providerType?: 'gemini' | 'demo' };
  analysis_completed: {
    durationBand: 'fast' | 'normal' | 'slow';
    durationSeconds?: number;
    inboundScore?: number;
    scoreBand?: 'low' | 'mid' | 'high';
    experienceCount?: number;
    sparseExperiencesCount?: number;
    gapsCount?: number;
  };
  diagnosis_viewed: {
    scoreBand: 'low' | 'mid' | 'high';
    inboundScore?: number;
    bottlenecksCount?: number;
    funnelSearchStatus?: string;
    funnelCardStatus?: string;
    funnelProfileStatus?: string;
  };

  // Funnel: Interview
  interview_started: {
    questionCount: number;
    hasSparseQuestions?: boolean;
    targetRole?: string;
  };
  interview_skipped: { reason?: 'user_opt_out'; questionsOffered?: number } | undefined;
  interview_completed: {
    answeredCount: number;
    skippedCount?: number;
    completionRate?: number;
    durationSeconds?: number;
  };

  // Funnel: Rewrite
  rewrite_completed:
    | {
        durationSeconds?: number;
        initialScore?: number;
        finalScore?: number;
        scoreDelta?: number;
        scoreDeltaBand?: 'minor' | 'moderate' | 'major';
      }
    | undefined;
  action_hub_viewed: {
    initialScoreBand: 'low' | 'mid' | 'high';
    initialScore?: number;
    finalScore?: number;
    scoreDelta?: number;
    spotlightMode?: boolean;
  };

  // Navigation
  tab_switched: { tab: string; fromTab?: string };

  // Search Simulator & Micro-Integrations
  search_tab_opened: undefined;
  search_query_run: {
    result: 'match' | 'weak' | 'missing';
    queryType?: 'preset' | 'custom';
    matchCount?: number;
    weakCount?: number;
    missingCount?: number;
  };
  recruiter_search_simulated: {
    result: 'match' | 'weak' | 'missing';
    queryType?: 'preset' | 'custom';
    matchCount?: number;
    weakCount?: number;
    missingCount?: number;
  };
  micro_integration_started: { kind: GapTermKind };
  micro_integration_applied: { kind: GapTermKind; outcome: 'match' | 'no_safe_change'; targetSection?: string };
  gap_resolved: { kind: GapTermKind; outcome: 'match' | 'no_safe_change'; targetSection?: string };

  // Actions / Value delivery
  copy_headline: { charCount?: number } | undefined;
  copy_about: { charCount?: number } | undefined;
  copy_experience: { bulletCount?: number } | undefined;
  copy_skills: { skillCount?: number } | undefined;
  copy_opentowork_titles: { count?: number } | undefined;

  // Launch Checklist
  launch_started: undefined;
  launch_completed: { totalItems?: number } | undefined;
  checklist_toggled: { itemIndex: number; checked: boolean; itemKey?: string; totalCompleted?: number };

  // MCP & AI Agents Hub
  mcp_modal_opened: { clientTab?: string; cliTab?: string } | undefined;
  mcp_connection_tested: { isRunning: boolean; port: number } | undefined;

  // System Health / API Telemetry
  api_error: {
    stage: 'diagnose' | 'interview' | 'rewrite' | 'connection';
    errorType: 'quota_exceeded' | 'invalid_key' | 'model_overloaded' | 'network' | 'unknown';
  };
}

export type TelemetryEventType = keyof TelemetryEventMap;

export interface TelemetryRecord {
  timestamp: number;
  event: TelemetryEventType;
  data?: Record<string, unknown>;
}

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, data?: Record<string, unknown>) => void;
    };
  }
}

const MAX_LOG_SIZE = 100;
const eventLog: TelemetryRecord[] = [];

const BLOCKED_KEYS = new Set([
  'profile',
  'pdf',
  'pdfbase64',
  'pdftext',
  'cvpdfbase64',
  'apikey',
  'key',
  'token',
  'secret',
  'answer',
  'answers',
  'facts',
  'statement',
  'summary',
  'headline',
  'experience',
  'experiences',
  'bullets',
  'description',
  'name',
  'email',
  'company',
]);

export function toScoreBand(score: number): 'low' | 'mid' | 'high' {
  if (score < 50) return 'low';
  if (score < 75) return 'mid';
  return 'high';
}

export function sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (BLOCKED_KEYS.has(key) || BLOCKED_KEYS.has(key.toLowerCase())) {
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > 100) continue; // Drop long text
      safe[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    }
  }

  return safe;
}

export function track<E extends keyof TelemetryEventMap>(
  event: E,
  ...args: undefined extends TelemetryEventMap[E] ? [data?: TelemetryEventMap[E]] : [data: TelemetryEventMap[E]]
): void {
  const data = args[0] as Record<string, unknown> | undefined;
  const cleanData = sanitizeData(data);

  const record: TelemetryRecord = {
    timestamp: Date.now(),
    event,
    data: cleanData,
  };

  eventLog.push(record);
  if (eventLog.length > MAX_LOG_SIZE) {
    eventLog.shift();
  }

  // External anonymous analytics dispatch (if Umami script is active)
  try {
    if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
      window.umami.track(event, cleanData);
    }
  } catch {
    // Fail silently: analytics must never disrupt app functionality
  }
}

export function toDurationBand(ms: number): 'fast' | 'normal' | 'slow' {
  if (ms < 5000) return 'fast';
  if (ms < 15000) return 'normal';
  return 'slow';
}

export function toScoreDeltaBand(delta: number): 'minor' | 'moderate' | 'major' {
  if (delta <= 5) return 'minor';
  if (delta <= 15) return 'moderate';
  return 'major';
}

export function categorizeApiError(
  err: unknown,
): 'quota_exceeded' | 'invalid_key' | 'model_overloaded' | 'network' | 'unknown' {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('exhausted') ||
    lower.includes('rate limit')
  ) {
    return 'quota_exceeded';
  }
  if (
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('invalid key')
  ) {
    return 'invalid_key';
  }
  if (
    lower.includes('503') ||
    lower.includes('overloaded') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('500')
  ) {
    return 'model_overloaded';
  }
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('cors') ||
    lower.includes('offline')
  ) {
    return 'network';
  }
  return 'unknown';
}

export function getRecentEvents(): ReadonlyArray<TelemetryRecord> {
  return [...eventLog];
}

export function clearTelemetry(): void {
  eventLog.length = 0;
}

/**
 * Injects Umami analytics script conditionally if VITE_UMAMI_WEBSITE_ID is provided.
 * Safe for SSR, dev mode, and test environments.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!websiteId) return;

  // Prevent duplicate script injection
  if (document.querySelector('script[data-website-id]')) return;

  const scriptSrc = import.meta.env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js';
  const script = document.createElement('script');
  script.defer = true;
  script.src = scriptSrc;
  script.setAttribute('data-website-id', websiteId);

  document.head.appendChild(script);
}


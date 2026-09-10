import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CdpStatus, ChromeTabInfo, ChromeVersionResponse, LinkeGringoSessionState, LinkeGringoTabInfo } from './types.js';

export function isLinkeGringoUrl(url = ''): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('localhost:5173') ||
    lower.includes('127.0.0.1:5173') ||
    lower.includes('localhost:4173') ||
    lower.includes('127.0.0.1:4173') ||
    lower.includes('linkegringo') ||
    lower.includes('muriel-gasparini.github.io')
  );
}

export function findDevToolsActivePort(): { port: number; wsPath: string } | null {
  const possiblePaths = [
    // Linux
    path.join(os.homedir(), '.config', 'google-chrome', 'DevToolsActivePort'),
    path.join(os.homedir(), '.config', 'chromium', 'DevToolsActivePort'),
    path.join(os.homedir(), '.config', 'google-chrome-beta', 'DevToolsActivePort'),
    // macOS
    path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'DevToolsActivePort'),
    // Windows
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'DevToolsActivePort'),
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      try {
        const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
        if (lines.length >= 2) {
          const port = parseInt(lines[0].trim(), 10);
          const wsPath = lines[1].trim();
          if (port > 0 && wsPath) {
            return { port, wsPath };
          }
        }
      } catch {
        // ignore read error
      }
    }
  }
  return null;
}

export async function probeViaWebSocket(
  port: number,
  wsPath: string,
  timeoutMs = 2000
): Promise<{
  linkeGringoTabs: LinkeGringoTabInfo[];
  otherTabsCount: number;
  sessionState: LinkeGringoSessionState | null;
} | null> {
  const wsUrl = `ws://127.0.0.1:${port}${wsPath}`;
  if (typeof globalThis.WebSocket !== 'function') return null;

  return new Promise((resolve) => {
    let ws: WebSocket;
    const timer = setTimeout(() => {
      try {
        ws?.close();
      } catch {}
      resolve(null);
    }, timeoutMs);

    try {
      ws = new globalThis.WebSocket(wsUrl);
    } catch {
      clearTimeout(timer);
      resolve(null);
      return;
    }

    let linkeTarget: any = null;
    let linkeGringoTabs: LinkeGringoTabInfo[] = [];
    let otherTabsCount = 0;

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Target.getTargets' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id === 1) {
          const targets = (msg.result?.targetInfos || []) as Array<{
            targetId: string;
            type: string;
            title: string;
            url: string;
          }>;

          const pageTargets = targets.filter((t) => t.type === 'page');
          const matched = pageTargets.filter((t) => isLinkeGringoUrl(t.url));

          // 🛡️ Privacy Shield: Armazena apenas abas do LinkeGringo.
          linkeGringoTabs = matched.map((t) => ({
            id: t.targetId,
            title: t.title,
            url: t.url,
          }));

          // Abas pessoais são apenas contabilizadas, nunca expostas
          otherTabsCount = pageTargets.length - matched.length;

          if (linkeGringoTabs.length === 0) {
            clearTimeout(timer);
            ws.close();
            resolve({ linkeGringoTabs: [], otherTabsCount, sessionState: null });
            return;
          }

          linkeTarget = matched[0];
          ws.send(
            JSON.stringify({
              id: 2,
              method: 'Target.attachToTarget',
              params: { targetId: linkeTarget.targetId, flatten: true },
            })
          );
        } else if (msg.id === 2) {
          const sessionId = msg.result?.sessionId;
          ws.send(
            JSON.stringify({
              id: 3,
              sessionId,
              method: 'Runtime.evaluate',
              params: {
                expression: 'window.localStorage.getItem("linkegringo_active_session")',
                returnByValue: true,
              },
            })
          );
        } else if (msg.id === 3) {
          clearTimeout(timer);
          ws.close();
          const raw = msg.result?.result?.value;
          let session: any = null;
          try {
            if (raw) session = JSON.parse(raw);
          } catch {}

          const hasUploadedProfile = Boolean(session && session.profile);
          const sessionState: LinkeGringoSessionState = {
            hasUploadedProfile,
            candidateName: session?.profile?.name,
            targetRole: session?.profile?.targetRole || session?.objective,
            step: session?.step || (hasUploadedProfile ? 'diagnostic' : 'upload'),
            inboundScore: session?.review?.inboundReadinessScore,
            profile: session?.profile || null,
            review: session?.review || null,
          };

          resolve({
            linkeGringoTabs,
            otherTabsCount,
            sessionState,
          });
        }
      } catch {
        clearTimeout(timer);
        try {
          ws?.close();
        } catch {}
        resolve(null);
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
  });
}

export async function checkChromeCdp(
  port = 9222,
  host = '127.0.0.1',
  timeoutMs = 5000
): Promise<CdpStatus> {
  // 1. Tenta via DevToolsActivePort nativo (CDP WebSocket direto)
  const activePortData = findDevToolsActivePort();
  if (activePortData) {
    const wsResult = await probeViaWebSocket(activePortData.port, activePortData.wsPath, timeoutMs);
    if (wsResult) {
      const found = wsResult.linkeGringoTabs.length > 0;
      return {
        isRunning: true,
        port: activePortData.port,
        host: '127.0.0.1',
        browser: 'Google Chrome (DevTools Protocol)',
        protocolVersion: '1.3',
        activeTabs: wsResult.linkeGringoTabs,
        linkeGringoTabs: wsResult.linkeGringoTabs,
        otherTabsCount: wsResult.otherTabsCount,
        linkeGringoTabFound: found,
        linkeGringoTabUrl: wsResult.linkeGringoTabs[0]?.url,
        sessionState: wsResult.sessionState,
      };
    }
  }

  // 2. Fallback HTTP (/json/version e /json/list)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const versionRes = await fetch(`http://${host}:${port}/json/version`, {
      signal: controller.signal,
    });

    if (!versionRes.ok) {
      throw new Error(`HTTP ${versionRes.status}: ${versionRes.statusText}`);
    }

    const versionData = (await versionRes.json()) as ChromeVersionResponse;

    let pageTabs: ChromeTabInfo[] = [];
    try {
      const listRes = await fetch(`http://${host}:${port}/json/list`, {
        signal: controller.signal,
      });
      if (listRes.ok) {
        const rawTabs = (await listRes.json()) as ChromeTabInfo[];
        if (Array.isArray(rawTabs)) {
          pageTabs = rawTabs.filter((t) => t.type === 'page');
        }
      }
    } catch {
      // Ignora erro em /json/list se /json/version respondeu
    }

    // 🛡️ Privacy Shield: Filtra estritamente abas do LinkeGringo
    const linkeGringoTabs = pageTabs
      .filter((t) => isLinkeGringoUrl(t.url))
      .map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        webSocketDebuggerUrl: t.webSocketDebuggerUrl,
      }));

    const otherTabsCount = pageTabs.length - linkeGringoTabs.length;
    const found = linkeGringoTabs.length > 0;

    return {
      isRunning: true,
      port,
      host,
      browser: versionData.Browser,
      protocolVersion: versionData['Protocol-Version'],
      activeTabs: linkeGringoTabs,
      linkeGringoTabs,
      otherTabsCount,
      linkeGringoTabFound: found,
      linkeGringoTabUrl: linkeGringoTabs[0]?.url,
      sessionState: null,
    };
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === 'AbortError' || error.name === 'TimeoutError';
    return {
      isRunning: false,
      port,
      host,
      activeTabs: [],
      linkeGringoTabs: [],
      otherTabsCount: 0,
      linkeGringoTabFound: false,
      sessionState: null,
      error: isTimeout
        ? 'Conexão expirou (Chrome não respondeu em 2s na porta ' + port + ')'
        : 'Porta fechada ou depuração remota desativada. Acesse chrome://inspect/#remote-debugging para ativar.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { checkChromeCdp } from '../src/cdp/probe.js';

describe('Chrome DevTools CDP Probe', () => {
  it('returns isRunning: false when port is closed without throwing unhandled exceptions', async () => {
    // Testing on an unused local port
    const result = await checkChromeCdp(59999, '127.0.0.1', 300);
    expect(result.isRunning).toBe(false);
    expect(result.linkeGringoTabFound).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('correctly parses version and identifies LinkeGringo tab when Chrome responds', async () => {
    const mockVersion = {
      Browser: 'Chrome/144.0.0.0',
      'Protocol-Version': '1.3',
      'User-Agent': 'Mozilla/5.0 Chrome',
      'V8-Version': '13.0',
      'WebKit-Version': '537.36',
    };

    const mockTabs = [
      {
        id: 'tab-1',
        title: 'Google',
        type: 'page',
        url: 'https://google.com',
      },
      {
        id: 'tab-2',
        title: 'LinkeGringo | Inbound Recruiter Optimizer',
        type: 'page',
        url: 'http://localhost:5173/linkegringo',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/tab-2',
      },
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/json/version')) {
        return {
          ok: true,
          json: async () => mockVersion,
        };
      }
      if (url.includes('/json/list')) {
        return {
          ok: true,
          json: async () => mockTabs,
        };
      }
      return { ok: false, status: 404 };
    }) as any;

    const originalExistsSync = fs.existsSync;
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    try {
      const result = await checkChromeCdp(9222, '127.0.0.1', 1000);
      expect(result.isRunning).toBe(true);
      expect(result.browser).toBe('Chrome/144.0.0.0');
      expect(result.protocolVersion).toBe('1.3');
      // 🛡️ Privacy Shield: Apenas a aba do LinkeGringo é mantida em activeTabs
      expect(result.activeTabs).toHaveLength(1);
      expect(result.activeTabs[0].url).toContain('localhost:5173');
      expect(result.otherTabsCount).toBe(1);
      expect(result.linkeGringoTabFound).toBe(true);
      expect(result.linkeGringoTabUrl).toContain('localhost:5173');
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });
});

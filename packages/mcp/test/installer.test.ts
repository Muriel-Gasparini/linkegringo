import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { installMcpServerConfig } from '../src/cli/installer.js';

describe('MCP CLI Installer', () => {
  const tmpDir = path.join(os.tmpdir(), `mcp-test-${Date.now()}`);
  const tmpConfigPath = path.join(tmpDir, 'test_mcp_config.json');

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('creates new config file when none exists', () => {
    const result = installMcpServerConfig(tmpConfigPath);
    expect(result.status).toBe('created');
    expect(fs.existsSync(tmpConfigPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(tmpConfigPath, 'utf8'));
    expect(data.mcpServers.linkegringo).toBeDefined();
    expect(data.mcpServers.linkegringo.command).toBe('npx');
    expect(data.mcpServers.linkegringo.args).toEqual(['-y', '@linkegringo/mcp']);
    expect(data.mcpServers['chrome-devtools']).toBeDefined();
  });

  it('preserves existing servers when updating config', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      tmpConfigPath,
      JSON.stringify({
        mcpServers: {
          existingServer: { command: 'node', args: ['server.js'] },
        },
      }),
    );

    const result = installMcpServerConfig(tmpConfigPath);
    expect(result.status).toBe('updated');

    const data = JSON.parse(fs.readFileSync(tmpConfigPath, 'utf8'));
    expect(data.mcpServers.existingServer).toBeDefined();
    expect(data.mcpServers.linkegringo).toBeDefined();
    expect(data.mcpServers['chrome-devtools']).toBeDefined();
  });

  it('parses CLI arguments correctly', async () => {
    const { parseArgs } = await import('../src/cli/installer.js');
    expect(parseArgs(['install', '--all'])).toEqual({ all: true });
    expect(parseArgs(['install', '--local'])).toEqual({ local: true });
    expect(parseArgs(['install', '--client=cursor'])).toEqual({ client: 'cursor' });
    expect(parseArgs(['install', '--force'])).toEqual({ all: true });
  });

  it('discovers supported MCP targets with detection metadata', async () => {
    const { getMcpConfigsForSystem } = await import('../src/cli/installer.js');
    const targets = getMcpConfigsForSystem();
    expect(targets.length).toBeGreaterThanOrEqual(3);
    const ids = targets.map((t) => t.id);
    expect(ids).toContain('antigravity');
    expect(ids).toContain('claude');
    expect(ids).toContain('cursor');
    for (const t of targets) {
      expect(typeof t.detected).toBe('boolean');
      expect(typeof t.configPath).toBe('string');
    }
  });
});

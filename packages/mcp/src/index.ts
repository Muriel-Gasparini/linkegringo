import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLinkeGringoMcpServer } from './server.js';
import { runInstaller } from './cli/installer.js';

export { createLinkeGringoMcpServer } from './server.js';
export * from './cdp/probe.js';
export * from './cdp/types.js';
export * from './cli/installer.js';
export * from './tools/audit-profile.js';
export * from './tools/recruiter-simulator.js';
export * from './tools/xyz-bullet-converter.js';
export * from './tools/headline-generator.js';
export * from './tools/cdp-check.js';

async function main() {
  if (
    process.argv.includes('install') ||
    process.argv.includes('setup') ||
    process.argv.includes('--install')
  ) {
    runInstaller(process.argv);
    return;
  }

  const server = createLinkeGringoMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[LinkeGringo MCP] Servidor iniciado com sucesso via stdio.');
}

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const scriptPath = fs.existsSync(process.argv[1])
      ? fs.realpathSync(process.argv[1])
      : process.argv[1];
    return (
      currentFilePath === scriptPath ||
      process.argv[1].endsWith('index.js') ||
      process.argv[1].endsWith('linkegringo-mcp') ||
      process.argv[1].endsWith('mcp') ||
      process.argv[1].endsWith('linkegringo')
    );
  } catch {
    return true;
  }
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error('[LinkeGringo MCP] Erro fatal na inicialização:', err);
    process.exit(1);
  });
}

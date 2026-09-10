import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface McpTarget {
  id: string;
  client: string;
  configPath: string;
  detected: boolean;
}

export interface InstallResult {
  client: string;
  configPath: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

export interface InstallerOptions {
  all?: boolean;
  local?: boolean;
  client?: string;
}

export function getMcpConfigsForSystem(): McpTarget[] {
  const home = os.homedir();
  const platform = os.platform();
  const configs: McpTarget[] = [];

  // 1. Google Antigravity (Multiplataforma)
  const antigravityPath = path.join(home, '.gemini', 'config', 'mcp_config.json');
  configs.push({
    id: 'antigravity',
    client: 'Google Antigravity',
    configPath: antigravityPath,
    detected: fs.existsSync(path.join(home, '.gemini')) || fs.existsSync(antigravityPath),
  });

  // 2. Claude Desktop
  let claudePath: string;
  let claudeDir: string;
  if (platform === 'darwin') {
    claudeDir = path.join(home, 'Library', 'Application Support', 'Claude');
    claudePath = path.join(claudeDir, 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    claudeDir = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude');
    claudePath = path.join(claudeDir, 'claude_desktop_config.json');
  } else {
    // Linux e outros
    claudeDir = path.join(home, '.config', 'Claude');
    claudePath = path.join(claudeDir, 'claude_desktop_config.json');
  }
  configs.push({
    id: 'claude',
    client: `Claude Desktop (${platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux'})`,
    configPath: claudePath,
    detected: fs.existsSync(claudeDir) || fs.existsSync(claudePath),
  });

  // 3. Cursor AI
  const cursorDir = path.join(home, '.cursor');
  const cursorPath = path.join(cursorDir, 'mcp.json');
  configs.push({
    id: 'cursor',
    client: 'Cursor AI',
    configPath: cursorPath,
    detected: fs.existsSync(cursorDir) || fs.existsSync(cursorPath),
  });

  // 4. Windsurf (se diretório existir)
  const windsurfDir = path.join(home, '.codeium', 'windsurf');
  const windsurfPath = path.join(windsurfDir, 'mcp_config.json');
  if (fs.existsSync(windsurfDir) || fs.existsSync(windsurfPath)) {
    configs.push({
      id: 'windsurf',
      client: 'Windsurf',
      configPath: windsurfPath,
      detected: true,
    });
  }

  return configs;
}

export function installMcpServerConfig(configPath: string): { status: 'created' | 'updated'; path: string } {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let configData: any = { mcpServers: {} };
  let isNew = true;

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      if (raw.trim()) {
        configData = JSON.parse(raw);
        isNew = false;
      }
    } catch {
      // Se estiver corrompido, inicializa estrutura válida
      configData = { mcpServers: {} };
    }
  }

  if (!configData.mcpServers || typeof configData.mcpServers !== 'object') {
    configData.mcpServers = {};
  }

  // Injeta o servidor oficial LinkeGringo (Zero API Key, 100% autônomo via npx)
  configData.mcpServers['linkegringo'] = {
    command: 'npx',
    args: ['-y', '@linkegringo/mcp'],
  };

  // Injeta o servidor oficial Chrome DevTools com autoConnect
  configData.mcpServers['chrome-devtools'] = {
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest', '--autoConnect'],
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2) + '\n', 'utf8');

  return {
    status: isNew ? 'created' : 'updated',
    path: configPath,
  };
}

export function parseArgs(args: string[] = []): InstallerOptions {
  const options: InstallerOptions = {};
  for (const arg of args) {
    if (arg === '--all' || arg === '--force') {
      options.all = true;
    } else if (arg === '--local' || arg === '-l') {
      options.local = true;
    } else if (arg.startsWith('--client=')) {
      options.client = arg.split('=')[1]?.toLowerCase().trim();
    }
  }
  return options;
}

export function runInstaller(args: string[] = process.argv): InstallResult[] {
  console.log('\n🚀 LinkeGringo MCP - Instalador Automático');
  console.log('================================================');
  console.log('ℹ️  Modo 100% Autônomo: Não requer o código-fonte do LinkeGringo na máquina.\n');

  const options = parseArgs(args);
  const targets = getMcpConfigsForSystem();
  const results: InstallResult[] = [];

  // Se --local foi passado, configura no diretório atual de trabalho
  if (options.local) {
    const cwd = process.cwd();
    const localCursorDir = path.join(cwd, '.cursor');
    const localPath = path.join(localCursorDir, 'mcp.json');
    try {
      const res = installMcpServerConfig(localPath);
      results.push({
        client: 'Workspace Local (Cursor)',
        configPath: localPath,
        status: res.status,
      });
      console.log(`✅ [Workspace Local]`);
      console.log(`   Arquivo: ${localPath} (${res.status === 'created' ? 'Criado' : 'Atualizado'})\n`);
    } catch (err: any) {
      results.push({
        client: 'Workspace Local',
        configPath: localPath,
        status: 'error',
        message: err.message,
      });
      console.warn(`⚠️ [Workspace Local] Erro ao configurar: ${err.message}\n`);
    }
    return results;
  }

  // Identifica clientes detectados
  const detectedTargets = targets.filter((t) => t.detected);
  const shouldInstallAll = options.all || detectedTargets.length === 0;

  for (const target of targets) {
    // Filtragem por --client
    if (options.client && !target.id.includes(options.client)) {
      continue;
    }

    // Se não for para instalar em todos e o cliente não estiver detectado na máquina
    if (!shouldInstallAll && !target.detected) {
      results.push({
        client: target.client,
        configPath: target.configPath,
        status: 'skipped',
        message: 'Cliente não detectado nesta máquina (use --all para forçar)',
      });
      console.log(`⏭️  [${target.client}] Não detectado nesta máquina (pulado. Use --all para criar)`);
      continue;
    }

    try {
      const res = installMcpServerConfig(target.configPath);
      results.push({
        client: target.client,
        configPath: target.configPath,
        status: res.status,
      });
      const tag = target.detected ? '(Detectado)' : '(Padrão)';
      console.log(`✅ [${target.client}] ${tag}`);
      console.log(`   Arquivo: ${target.configPath} (${res.status === 'created' ? 'Criado' : 'Atualizado'})\n`);
    } catch (err: any) {
      results.push({
        client: target.client,
        configPath: target.configPath,
        status: 'error',
        message: err.message,
      });
      console.warn(`⚠️ [${target.client}] Não foi possível atualizar: ${err.message}\n`);
    }
  }

  console.log('---');
  console.log('💡 Comandos One-Line diretos para agentes de linha de comando (CLI):');
  console.log('   • Antigravity CLI: agy mcp add linkegringo npx -y @linkegringo/mcp');
  console.log('   • Codex CLI:       codex mcp add linkegringo -- npx -y @linkegringo/mcp');
  console.log('   • Claude Code CLI: claude mcp add linkegringo npx -y @linkegringo/mcp');
  console.log('   • Goose CLI:       goose configure --add-extension "npx -y @linkegringo/mcp"');
  console.log('================================================');
  console.log('🎉 Instalação concluída! Reinicie o seu cliente de IA para ativar.\n');

  return results;
}

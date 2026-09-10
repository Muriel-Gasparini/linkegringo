import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Cpu,
  ExternalLink,
  FileCode,
  Info,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { track } from '../lib/telemetry';
import { Button } from './ui/button';

interface McpHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ClientTab = 'claude' | 'antigravity' | 'cursor' | 'codex';
type CliAgent = 'universal' | 'agy' | 'codex' | 'claude' | 'goose';

export function McpHubModal({ isOpen, onClose }: McpHubModalProps) {
  const [activeCliTab, setActiveCliTab] = useState<CliAgent>('universal');
  const [showManualConfig, setShowManualConfig] = useState(false);
  const [activeClientTab, setActiveClientTab] = useState<ClientTab>('claude');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showLegacyCommands, setShowLegacyCommands] = useState(false);

  // CDP Live Probe State
  const [cdpStatus, setCdpStatus] = useState<'idle' | 'testing' | 'connected' | 'offline'>('idle');
  const [cdpMessage, setCdpMessage] = useState<string>('');
  const [cdpTabsCount, setCdpTabsCount] = useState<number>(0);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleTestCdpConnection = async () => {
    setCdpStatus('testing');
    setCdpMessage('Tentando conectar em http://127.0.0.1:9222...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('http://127.0.0.1:9222/json/version', {
        signal: controller.signal,
        mode: 'no-cors', // O Chrome CDP pode requerer no-cors ou PNA no browser
      });
      clearTimeout(timeoutId);

      // Se a requisição retornou (mesmo opaca), a porta 9222 está aberta e ouvindo
      setCdpStatus('connected');
      setCdpMessage('Porta 9222 está respondendo ativamente! O Chrome Remote Debugging está disponível.');
      track('mcp_connection_tested', { isRunning: true, port: 9222 });
    } catch {
      setCdpStatus('offline');
      setCdpMessage(
        'Não foi possível conectar na porta 9222. Acesse chrome://inspect/#remote-debugging no seu Chrome e marque a opção para ativar a depuração remota.',
      );
      track('mcp_connection_tested', { isRunning: false, port: 9222 });
    }
  };

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        linkegringo: {
          command: 'npx',
          args: ['-y', '@linkegringo/mcp'],
        },
        'chrome-devtools': {
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp@latest', '--autoConnect'],
        },
      },
    },
    null,
    2,
  );

  const antigravityConfigJson = JSON.stringify(
    {
      mcpServers: {
        linkegringo: {
          command: 'npx',
          args: ['-y', '@linkegringo/mcp'],
        },
        'chrome-devtools': {
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp@latest', '--autoConnect'],
        },
      },
    },
    null,
    2,
  );

  const cursorConfigJson = JSON.stringify(
    {
      mcpServers: {
        linkegringo: {
          command: 'npx',
          args: ['-y', '@linkegringo/mcp'],
        },
        'chrome-devtools': {
          command: 'npx',
          args: ['-y', 'chrome-devtools-mcp@latest', '--autoConnect'],
        },
      },
    },
    null,
    2,
  );

  const codexConfigToml = `[mcp_servers.linkegringo]
command = "npx"
args = ["-y", "@linkegringo/mcp"]

[mcp_servers.chrome-devtools]
command = "npx"
args = ["-y", "chrome-devtools-mcp@latest", "--autoConnect"]`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0B0F19] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B] bg-[#0E1424]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="mcp-modal-title" className="text-base font-semibold text-white">
                  LinkeGringo MCP & Agentes de IA
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full">
                  Zero Chave de API • 100% Gratuito
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Conecte ferramentas de ATS diretamente no seu agente de IA (Claude Desktop, Google Antigravity, Cursor AI, Goose)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Zero API Key Callout */}
          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
            <p className="leading-relaxed">
              <strong>O seu próprio agente de IA é o cérebro:</strong> Você não precisa de chave da API do Gemini nem de nenhum outro provedor. O servidor MCP roda localmente na sua máquina e equipa o seu agente (Claude, Antigravity, Cursor) com as regras do LinkedIn ATS, fórmulas Google XYZ e ferramentas de inspeção do Chrome via CDP com custo zero!
            </p>
          </div>
          {/* Card 1: Chrome Remote Debugging (Modern W3C / CDP Flow) */}
          <div className="p-5 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-semibold text-white">
                    1. Ativação no Google Chrome (Sem Terminal!)
                  </h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                    Chrome M144+
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O Chrome agora possui depuração remota nativa na interface. Você não precisa fechar seu navegador nem rodar comandos no terminal!
                </p>
              </div>

              {/* Live Probe Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestCdpConnection}
                disabled={cdpStatus === 'testing'}
                className="shrink-0 text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 h-8 gap-1.5"
              >
                <Radio className={`w-3.5 h-3.5 ${cdpStatus === 'testing' ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
                <span>{cdpStatus === 'testing' ? 'Verificando...' : 'Testar Porta 9222'}</span>
              </Button>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-lg bg-[#0A0E1A] border border-[#1E293B]/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyan-300">Passo A: Acessar Configuração</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('chrome://inspect/#remote-debugging', 'chrome-url')}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedKey === 'chrome-url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'chrome-url' ? 'Copiado' : 'Copiar URL'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Abra uma nova aba no Chrome e cole:
                </p>
                <code className="block p-2 rounded bg-black/50 text-cyan-300 text-xs font-mono select-all">
                  chrome://inspect/#remote-debugging
                </code>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0A0E1A] border border-[#1E293B]/80 space-y-2">
                <span className="text-xs font-semibold text-cyan-300">Passo B: Autorizar Sessão</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Marque a caixa para <strong>Ativar depuração remota</strong>. Quando seu agente de IA chamar o servidor DevTools com <code className="text-slate-200 font-mono">--autoConnect</code>, clique em <strong>Permitir</strong> no diálogo do Chrome.
                </p>
              </div>
            </div>

            {/* Probe Feedback Banner */}
            {cdpStatus !== 'idle' && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2.5 border ${
                  cdpStatus === 'connected'
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : cdpStatus === 'testing'
                      ? 'bg-cyan-950/30 border-cyan-500/30 text-cyan-300'
                      : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}
              >
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{cdpMessage}</p>
              </div>
            )}

            {/* Collapsible Legacy Terminal Fallback */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowLegacyCommands(!showLegacyCommands)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                {showLegacyCommands ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Usando Chrome antigo (&lt; 144)? Veja a inicialização por terminal</span>
              </button>

              {showLegacyCommands && (
                <div className="mt-3 p-3.5 rounded-lg bg-black/40 border border-[#1E293B] space-y-3 animate-in fade-in">
                  <p className="text-xs text-slate-400">
                    Se sua versão do Chrome não tiver a opção visual, inicie-o pelo terminal com porta de depuração:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Linux</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            'google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_linkegringo"',
                            'cmd-linux',
                          )
                        }
                        className="hover:text-white"
                      >
                        {copiedKey === 'cmd-linux' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="p-2 rounded bg-black/60 text-slate-300 text-[11px] font-mono overflow-x-auto">
                      google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_linkegringo"
                    </pre>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>macOS</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_linkegringo"',
                            'cmd-mac',
                          )
                        }
                        className="hover:text-white"
                      >
                        {copiedKey === 'cmd-mac' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="p-2 rounded bg-black/60 text-slate-300 text-[11px] font-mono overflow-x-auto">
                      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/tmp/chrome_dev_linkegringo"
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: One-Liner CLI Terminal Setup (100% Focused on CLI) */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-[#0E1526] to-emerald-950/30 border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  2. Instalação One-Line no Terminal (Foco CLI)
                </h3>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                1 Clique
              </span>
            </div>

            {/* CLI Sub-Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-black/50 border border-cyan-500/20 overflow-x-auto">
              {(
                [
                  { id: 'universal', label: '⚡ Universal (Auto)' },
                  { id: 'agy', label: 'Antigravity (agy)' },
                  { id: 'codex', label: 'Codex CLI' },
                  { id: 'claude', label: 'Claude Code' },
                  { id: 'goose', label: 'Goose CLI' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveCliTab(tab.id);
                    track('mcp_modal_opened', { cliTab: tab.id });
                  }}
                  className={`py-1 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                    activeCliTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* CLI Tab Content: Universal */}
            {activeCliTab === 'universal' && (
              <div className="space-y-2 animate-in fade-in">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Configura automaticamente <strong>Google Antigravity</strong>, <strong>Claude Desktop</strong> e <strong>Cursor AI</strong> na sua máquina (Linux, macOS, Windows) sem abrir nenhum arquivo:
                </p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/70 border border-cyan-500/30">
                  <code className="text-xs font-mono text-cyan-300 select-all">
                    npx -y @linkegringo/mcp install
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('npx -y @linkegringo/mcp install', 'cmd-universal')}
                    className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                  >
                    {copiedKey === 'cmd-universal' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd-universal' ? 'Copiado!' : 'Copiar'}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* CLI Tab Content: Antigravity CLI */}
            {activeCliTab === 'agy' && (
              <div className="space-y-2.5 animate-in fade-in">
                <p className="text-xs text-slate-300">
                  Comando oficial para registrar no <strong>Antigravity CLI (<code className="font-mono text-cyan-300">agy</code>)</strong>:
                </p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/70 border border-cyan-500/30">
                  <code className="text-xs font-mono text-cyan-300 select-all">
                    agy mcp add linkegringo npx -y @linkegringo/mcp
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('agy mcp add linkegringo npx -y @linkegringo/mcp', 'cmd-agy')}
                    className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                  >
                    {copiedKey === 'cmd-agy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd-agy' ? 'Copiado!' : 'Copiar'}</span>
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-[#1E293B] text-[11px]">
                  <span className="text-slate-400 font-mono">
                    agy mcp add chrome-devtools npx -y chrome-devtools-mcp@latest --autoConnect
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard('agy mcp add chrome-devtools npx -y chrome-devtools-mcp@latest --autoConnect', 'cmd-agy-cdp')
                    }
                    className="text-cyan-400 hover:text-cyan-300 pl-2 shrink-0"
                  >
                    {copiedKey === 'cmd-agy-cdp' ? 'Copiado!' : 'Copiar Chrome DevTools'}
                  </button>
                </div>
              </div>
            )}

            {/* CLI Tab Content: Codex CLI */}
            {activeCliTab === 'codex' && (
              <div className="space-y-2.5 animate-in fade-in">
                <p className="text-xs text-slate-300">
                  Comando oficial para registrar no <strong>Codex CLI (OpenAI)</strong>:
                </p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/70 border border-cyan-500/30">
                  <code className="text-xs font-mono text-cyan-300 select-all">
                    codex mcp add linkegringo -- npx -y @linkegringo/mcp
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('codex mcp add linkegringo -- npx -y @linkegringo/mcp', 'cmd-codex')}
                    className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                  >
                    {copiedKey === 'cmd-codex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd-codex' ? 'Copiado!' : 'Copiar'}</span>
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-[#1E293B] text-[11px]">
                  <span className="text-slate-400 font-mono">
                    codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --autoConnect
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard('codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --autoConnect', 'cmd-codex-cdp')
                    }
                    className="text-cyan-400 hover:text-cyan-300 pl-2 shrink-0"
                  >
                    {copiedKey === 'cmd-codex-cdp' ? 'Copiado!' : 'Copiar Chrome DevTools'}
                  </button>
                </div>
              </div>
            )}

            {/* CLI Tab Content: Claude Code CLI */}
            {activeCliTab === 'claude' && (
              <div className="space-y-2.5 animate-in fade-in">
                <p className="text-xs text-slate-300">
                  Comando oficial para registrar no <strong>Claude Code CLI</strong>:
                </p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/70 border border-cyan-500/30">
                  <code className="text-xs font-mono text-cyan-300 select-all">
                    claude mcp add linkegringo npx -y @linkegringo/mcp
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('claude mcp add linkegringo npx -y @linkegringo/mcp', 'cmd-claude-cli')}
                    className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                  >
                    {copiedKey === 'cmd-claude-cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd-claude-cli' ? 'Copiado!' : 'Copiar'}</span>
                  </Button>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-[#1E293B] text-[11px]">
                  <span className="text-slate-400 font-mono">
                    claude mcp add chrome-devtools npx -y chrome-devtools-mcp@latest --autoConnect
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard('claude mcp add chrome-devtools npx -y chrome-devtools-mcp@latest --autoConnect', 'cmd-claude-cdp')
                    }
                    className="text-cyan-400 hover:text-cyan-300 pl-2 shrink-0"
                  >
                    {copiedKey === 'cmd-claude-cdp' ? 'Copiado!' : 'Copiar Chrome DevTools'}
                  </button>
                </div>
              </div>
            )}

            {/* CLI Tab Content: Goose CLI */}
            {activeCliTab === 'goose' && (
              <div className="space-y-2 animate-in fade-in">
                <p className="text-xs text-slate-300">
                  Comando oficial para registrar a extensão no <strong>Goose CLI (Block)</strong>:
                </p>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/70 border border-cyan-500/30">
                  <code className="text-xs font-mono text-cyan-300 select-all">
                    goose configure --add-extension "npx -y @linkegringo/mcp"
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard('goose configure --add-extension "npx -y @linkegringo/mcp"', 'cmd-goose')
                    }
                    className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                  >
                    {copiedKey === 'cmd-goose' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd-goose' ? 'Copiado!' : 'Copiar'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Accordion Fechado por Padrão: Configuração Manual via Arquivo (JSON / TOML) */}
          <div className="rounded-xl border border-[#1E293B] bg-[#0A0E1A] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowManualConfig(!showManualConfig)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-[#0F172A] transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileCode className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Configuração Manual via Arquivo (JSON / TOML)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Opcional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Abra aqui apenas se preferir editar arquivos de configuração manualmente em vez do terminal
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  showManualConfig ? 'rotate-180 text-cyan-400' : ''
                }`}
              />
            </button>

            {showManualConfig && (
              <div className="p-4 border-t border-[#1E293B] space-y-3 bg-[#0B0F19] animate-in fade-in">
                {/* Tab Selector */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0F172A] border border-[#1E293B]">
                  {(
                    [
                      { id: 'claude', label: 'Claude Desktop' },
                      { id: 'antigravity', label: 'Google Antigravity' },
                      { id: 'cursor', label: 'Cursor AI' },
                      { id: 'codex', label: 'Codex (TOML)' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveClientTab(tab.id);
                        track('mcp_modal_opened', { clientTab: tab.id });
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                        activeClientTab === tab.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content: Claude Desktop */}
                {activeClientTab === 'claude' && (
                  <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-300">
                        Arquivo: <code className="font-mono text-cyan-300">claude_desktop_config.json</code>
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(claudeConfigJson, 'claude-json')}
                        className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                      >
                        {copiedKey === 'claude-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'claude-json' ? 'Copiado!' : 'Copiar Configuração'}</span>
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-black/60 text-slate-300 text-xs font-mono overflow-x-auto border border-[#1E293B]">
                      {claudeConfigJson}
                    </pre>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        macOS: <code className="font-mono text-slate-300">~/Library/Application Support/Claude/claude_desktop_config.json</code> | Linux: <code className="font-mono text-slate-300">~/.config/Claude/claude_desktop_config.json</code>
                      </span>
                    </div>
                  </div>
                )}

                {/* Tab Content: Antigravity */}
                {activeClientTab === 'antigravity' && (
                  <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-300">
                        Arquivo: <code className="font-mono text-cyan-300">~/.gemini/config/mcp_config.json</code>
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(antigravityConfigJson, 'antigravity-json')}
                        className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                      >
                        {copiedKey === 'antigravity-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'antigravity-json' ? 'Copiado!' : 'Copiar Configuração'}</span>
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-black/60 text-slate-300 text-xs font-mono overflow-x-auto border border-[#1E293B]">
                      {antigravityConfigJson}
                    </pre>
                  </div>
                )}

                {/* Tab Content: Cursor AI */}
                {activeClientTab === 'cursor' && (
                  <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-300">
                        Arquivo: <code className="font-mono text-cyan-300">~/.cursor/mcp.json</code>
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(cursorConfigJson, 'cursor-json')}
                        className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                      >
                        {copiedKey === 'cursor-json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'cursor-json' ? 'Copiado!' : 'Copiar Configuração'}</span>
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-black/60 text-slate-300 text-xs font-mono overflow-x-auto border border-[#1E293B]">
                      {cursorConfigJson}
                    </pre>
                  </div>
                )}

                {/* Tab Content: Codex CLI (TOML) */}
                {activeClientTab === 'codex' && (
                  <div className="p-4 rounded-xl bg-[#0F172A]/70 border border-[#1E293B] space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-300">
                        Arquivo: <code className="font-mono text-cyan-300">~/.codex/config.toml</code>
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(codexConfigToml, 'codex-toml')}
                        className="h-7 text-xs text-cyan-400 hover:text-cyan-300 gap-1"
                      >
                        {copiedKey === 'codex-toml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'codex-toml' ? 'Copiado!' : 'Copiar TOML'}</span>
                      </Button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-black/60 text-slate-300 text-xs font-mono overflow-x-auto border border-[#1E293B]">
                      {codexConfigToml}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: MCP Tools Exposed */}
          <div className="p-4 rounded-xl bg-[#0A0E1A] border border-[#1E293B] space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Ferramentas Nativas Disponíveis no Servidor MCP
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-[#0F172A]/50 border border-[#1E293B]/60">
                <div className="font-mono font-medium text-cyan-300">audit_profile</div>
                <div className="text-slate-400 mt-0.5 text-[11px]">
                  Diagnóstico completo, nota Inbound (0-100), gargalos e lacunas técnicas.
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#0F172A]/50 border border-[#1E293B]/60">
                <div className="font-mono font-medium text-cyan-300">simulate_recruiter_search</div>
                <div className="text-slate-400 mt-0.5 text-[11px]">
                  Simula filtros booleanos do LinkedIn Recruiter com peso 3x em Headline/Skills.
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#0F172A]/50 border border-[#1E293B]/60">
                <div className="font-mono font-medium text-cyan-300">convert_to_xyz_bullet</div>
                <div className="text-slate-400 mt-0.5 text-[11px]">
                  Transforma bullets comuns na fórmula Accomplished [X], measured by [Y], by doing [Z].
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#0F172A]/50 border border-[#1E293B]/60">
                <div className="font-mono font-medium text-cyan-300">generate_headline_proposals</div>
                <div className="text-slate-400 mt-0.5 text-[11px]">
                  Gera 3 variações de Headline $\le$ 160 caracteres para visualização perfeita.
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#0F172A]/50 border border-[#1E293B]/60 sm:col-span-2">
                <div className="font-mono font-medium text-cyan-300">check_chrome_cdp_status</div>
                <div className="text-slate-400 mt-0.5 text-[11px]">
                  Verifica a porta de depuração do Chrome (9222) e lista abas abertas do LinkeGringo.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#1E293B] bg-[#0E1424]">
          <span className="text-xs text-slate-400">
            LinkeGringo é 100% Client-Side e Open Source. Suas credenciais nunca saem da sua máquina.
          </span>
          <Button variant="default" size="sm" onClick={onClose} className="h-8 px-4 text-xs font-medium">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

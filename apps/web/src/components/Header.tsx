import React from 'react';
import { Key, HelpCircle, RefreshCw, Terminal } from 'lucide-react';
import { Button } from './ui/button';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface HeaderProps {
  apiKey: string;
  providerId: string;
  model?: string;
  onOpenApiKeyDialog: () => void;
  onOpenOnboarding: () => void;
  onOpenMcpHub: () => void;
  onToggleDemoMode: () => void;
  onResetSession: () => void;
  hasActiveSession: boolean;
}

export function Header({
  apiKey,
  providerId,
  model,
  onOpenApiKeyDialog,
  onOpenOnboarding,
  onOpenMcpHub,
  onToggleDemoMode,
  onResetSession,
  hasActiveSession,
}: HeaderProps) {
  const isDemo = providerId === 'demo';
  const hasKey = Boolean(apiKey && apiKey.trim().length > 0);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1E293B] bg-[#090D14]/90 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <span className="font-semibold text-lg tracking-tight text-white">
            LinkeGringo
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Posicionamento internacional para desenvolvedores
          </span>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Status Indicator */}
          {isDemo ? (
            <button
              type="button"
              onClick={onToggleDemoMode}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-[#0F1623] text-slate-300 border border-[#1E293B] hover:border-slate-600 transition-colors cursor-pointer"
              title="Modo Demonstração ativo. Clique para alternar."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Modo Demonstração</span>
            </button>
          ) : hasKey ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium bg-[#0F1623] text-slate-300 border border-[#1E293B]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{model || 'Gemini Conectado'}</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenApiKeyDialog}
              className="text-xs text-slate-300 hover:text-white border-[#1E293B] bg-[#0F1623] hover:bg-[#151E2E] h-8 px-3 gap-1.5 font-normal"
            >
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>Configurar Chave</span>
            </Button>
          )}

          {/* Clean Action Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {hasActiveSession && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetSession}
                className="text-xs text-slate-400 hover:text-slate-200 hover:bg-[#0F1623] h-8 px-2.5 gap-1.5 font-normal"
                title="Recomeçar do zero"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Novo Perfil</span>
              </Button>
            )}

            {(hasKey || isDemo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenApiKeyDialog}
                className="text-xs text-slate-400 hover:text-slate-200 hover:bg-[#0F1623] h-8 px-2.5 gap-1.5 font-normal"
              >
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Chave de API</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenMcpHub}
              className="text-xs text-cyan-300 hover:text-white border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-900/30 h-8 px-2.5 gap-1.5 font-medium"
              title="Integrar com Agentes de IA via Model Context Protocol"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Agentes / MCP</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenOnboarding}
              className="text-xs text-slate-400 hover:text-slate-200 hover:bg-[#0F1623] h-8 px-2.5 gap-1.5 font-normal"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Como Funciona</span>
            </Button>

            <a
              href="https://github.com/Muriel-Gasparini/linkegringo"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-[#0F1623] transition-colors"
              title="Repositório no GitHub"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

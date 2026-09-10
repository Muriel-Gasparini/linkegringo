export interface ChromeVersionResponse {
  Browser: string;
  'Protocol-Version': string;
  'User-Agent': string;
  'V8-Version': string;
  'WebKit-Version': string;
  webSocketDebuggerUrl?: string;
}

export interface ChromeTabInfo {
  id: string;
  title: string;
  type: string;
  url: string;
  description?: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
}

export interface LinkeGringoTabInfo {
  id: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface LinkeGringoSessionState {
  hasUploadedProfile: boolean;
  candidateName?: string;
  targetRole?: string;
  step?: string;
  inboundScore?: number;
  profile?: any;
  review?: any;
}

export interface CdpStatus {
  isRunning: boolean;
  port: number;
  host: string;
  browser?: string;
  protocolVersion?: string;
  /**
   * Abas ativas restritas estritamente ao escopo do LinkeGringo (Privacy Shield).
   * Abas pessoais (e-mails, mensageiros, bancos) são completamente omitidas.
   */
  activeTabs: LinkeGringoTabInfo[];
  linkeGringoTabs: LinkeGringoTabInfo[];
  otherTabsCount: number;
  linkeGringoTabFound: boolean;
  linkeGringoTabUrl?: string;
  sessionState?: LinkeGringoSessionState | null;
  error?: string;
}

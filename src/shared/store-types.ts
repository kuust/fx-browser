export type CookieImportStatus = 'none' | 'pending' | 'imported' | 'failed';

export type EnvironmentListItem = {
  environmentId: string;
  importOrder: number;
  profileName: string;
  platform: string;
  platformDomain: string;
  loginAccount: string;
  sourceProfileId: string;
  proxyRaw: string;
  proxyHost: string;
  proxyPort: number | null;
  proxyNumber: string;
  profileGroup: string;
  profileTag: string;
  profileNote: string;
  userAgent: string;
  cookieCount: number;
  cookieRaw: string;
  cookieImportStatus: CookieImportStatus;
  cookieImportedAt: string | null;
  cookieImportError: string;
  status: 'stopped' | 'running';
};

export type SavedImportSummary = {
  sourceFileName: string;
  importedAt: string;
  totalProfiles: number;
  cookieParseSuccess: number;
  cookieParseFailed: number;
  proxyParseSuccess: number;
  proxyEmpty: number;
  warnings: string[];
};


export type ProxyListItem = {
  proxyId: string;
  importOrder: number;
  proxyType: string;
  proxyHost: string;
  proxyPort: number | null;
  proxyAccount: string;
  proxyPassword: string;
  refreshUrl: string;
  proxyGroup: string;
  proxyName: string;
  ipQueryChannel: string;
  status: 'normal' | 'failed' | 'pending';
  lastCheckedIp: string;
  lastCheckedAt: string | null;
};

export type BrowserEnvDraft = {
  environmentName: string;
  browserType: string;
  operatingSystem: string;
  userAgentMode: string;
  userAgent: string;
  proxyType: string;
  proxyChannel: string;
  proxyServer: string;
  proxyAccount: string;
  proxyPassword: string;
  refreshUrl: string;
  ipChangeMonitor: boolean;
  proxyMode: string;
  accountCookie: string;
  openUrl: string;
  languageMode: string;
  timezoneMode: string;
  geolocationMode: string;
  resolution: string;
  fontListMode: string;
  fontProtection: string;
  webrtc: string;
  canvas: string;
  webglImage: string;
  webglInfo: string;
  webgpu: string;
  audioContext: string;
  speechVoices: string;
  hardwareSettings: string;
  hardwareConcurrency: string;
  deviceMemory: string;
  doNotTrack: string;
  battery: string;
  portScanProtection: string;
  pageTlsProtocol: string;
  startupArgs: string;
  cookieIsolation: string;
  multiOpen: string;
  webNotification: string;
  clipboardProtection: string;
};

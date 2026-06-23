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

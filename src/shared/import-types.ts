export type MoreLoginCookie = {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  http_only?: boolean;
  expires?: string;
  same_site?: string;
  [key: string]: unknown;
};

export type ParsedProxy = {
  raw: string;
  type: 'http' | 'https' | 'socks5' | 'unknown';
  host: string;
  port: number | null;
  username: string;
  password: string;
};

export type MoreLoginProfile = {
  importOrder: number;
  profileName: string;
  platform: string;
  userDefinedPlatformDomainName: string;
  loginAccount: string;
  loginPassword: string;
  twoFaKey: string;
  passwordProtection: string;
  sourceProfileId: string;
  cookieRaw: string;
  cookieCount: number;
  proxyInformationRaw: string;
  proxy: ParsedProxy | null;
  proxyNumber: string;
  profileGroup: string;
  profileTag: string;
  profileNote: string;
  userAgent: string;
  endToEndEncryption: string;
  customNumber: string;
};

export type MoreLoginImportReport = {
  totalProfiles: number;
  cookieParseSuccess: number;
  cookieParseFailed: number;
  proxyParseSuccess: number;
  proxyEmpty: number;
  profiles: MoreLoginProfile[];
  warnings: string[];
};

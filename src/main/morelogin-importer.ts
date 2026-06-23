import type { MoreLoginCookie, MoreLoginImportReport, MoreLoginProfile, ParsedProxy } from '../shared/import-types.js';

const KEY_MAP: Record<string, keyof Omit<MoreLoginProfile, 'importOrder' | 'cookieCount' | 'proxy'>> = {
  'Profile name': 'profileName',
  Platform: 'platform',
  'User-defined platform domain name': 'userDefinedPlatformDomainName',
  'Login account': 'loginAccount',
  'Login password': 'loginPassword',
  '2FA key': 'twoFaKey',
  'Password protection': 'passwordProtection',
  'Profile ID': 'sourceProfileId',
  Cookie: 'cookieRaw',
  'Proxy information': 'proxyInformationRaw',
  'Proxy Number': 'proxyNumber',
  'Profile group': 'profileGroup',
  'Profile tag': 'profileTag',
  'Profile note': 'profileNote',
  UA: 'userAgent',
  'End-to-end encryption': 'endToEndEncryption',
  'Custom number': 'customNumber',
};

function emptyProfile(importOrder: number): MoreLoginProfile {
  return {
    importOrder,
    profileName: '',
    platform: '',
    userDefinedPlatformDomainName: '',
    loginAccount: '',
    loginPassword: '',
    twoFaKey: '',
    passwordProtection: '',
    sourceProfileId: '',
    cookieRaw: '',
    cookieCount: 0,
    proxyInformationRaw: '',
    proxy: null,
    proxyNumber: '',
    profileGroup: '',
    profileTag: '',
    profileNote: '',
    userAgent: '',
    endToEndEncryption: '',
    customNumber: '',
  };
}

export function parseMoreLoginProxy(raw: string): ParsedProxy | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(https?|socks5):\/\/(.+)$/i);
  if (!match) {
    return { raw: trimmed, type: 'unknown', host: '', port: null, username: '', password: '' };
  }

  const type = match[1].toLowerCase() as ParsedProxy['type'];
  const rest = match[2];

  // MoreLogin often exports: socks5://host:port:username:password
  // Standard URLs may be: socks5://username:password@host:port
  if (rest.includes('@')) {
    try {
      const url = new URL(trimmed);
      return {
        raw: trimmed,
        type,
        host: url.hostname,
        port: url.port ? Number(url.port) : null,
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
      };
    } catch {
      return { raw: trimmed, type: 'unknown', host: '', port: null, username: '', password: '' };
    }
  }

  const parts = rest.split(':');
  const [host = '', portText = '', username = '', ...passwordParts] = parts;
  const port = portText && /^\d+$/.test(portText) ? Number(portText) : null;
  return {
    raw: trimmed,
    type,
    host,
    port,
    username,
    password: passwordParts.join(':'),
  };
}

function countCookies(raw: string): number {
  if (!raw.trim()) return 0;
  const parsed = JSON.parse(raw) as MoreLoginCookie[];
  if (!Array.isArray(parsed)) throw new Error('Cookie field is not a JSON array');
  return parsed.length;
}

export function parseMoreLoginExportText(text: string): MoreLoginImportReport {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const profiles: MoreLoginProfile[] = [];
  const warnings: string[] = [];
  let current: MoreLoginProfile | null = null;

  const pushCurrent = () => {
    if (!current) return;

    try {
      current.cookieCount = countCookies(current.cookieRaw);
    } catch (error) {
      warnings.push(`Profile #${current.importOrder}: cookie parse failed: ${(error as Error).message}`);
      current.cookieCount = 0;
    }

    current.proxy = parseMoreLoginProxy(current.proxyInformationRaw);
    profiles.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex);
    const value = line.slice(equalsIndex + 1);

    if (key === 'Profile name') {
      pushCurrent();
      current = emptyProfile(profiles.length + 1);
    }

    if (!current) continue;
    const mappedKey = KEY_MAP[key];
    if (!mappedKey) {
      warnings.push(`Profile #${current.importOrder}: unknown key '${key}' ignored`);
      continue;
    }

    current[mappedKey] = value as never;
  }

  pushCurrent();

  const cookieParseSuccess = profiles.filter((profile) => profile.cookieRaw && profile.cookieCount > 0).length;
  const cookieParseFailed = profiles.filter((profile) => profile.cookieRaw && profile.cookieCount === 0).length;
  const proxyEmpty = profiles.filter((profile) => !profile.proxyInformationRaw.trim()).length;
  const proxyParseSuccess = profiles.filter((profile) => profile.proxyInformationRaw.trim() && profile.proxy?.host && profile.proxy.port).length;

  return {
    totalProfiles: profiles.length,
    cookieParseSuccess,
    cookieParseFailed,
    proxyParseSuccess,
    proxyEmpty,
    profiles,
    warnings,
  };
}

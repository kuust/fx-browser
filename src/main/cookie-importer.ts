import type { EnvironmentListItem } from '../shared/store-types.js';
import type { MoreLoginCookie } from '../shared/import-types.js';

export type CdpCookie = {
  name: string;
  value: string;
  domain?: string;
  url?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expires?: number;
  sameSite?: 'Strict' | 'Lax' | 'None';
};

export type CookieImportResult = {
  status: 'imported' | 'skipped' | 'failed';
  environmentId: string;
  importedCount: number;
  message: string;
};

export type CookieImportTransport = {
  setCookies(cookies: CdpCookie[]): Promise<void>;
};

export function shouldImportCookies(environment: EnvironmentListItem, force = false): boolean {
  if (!environment.cookieRaw.trim() || environment.cookieCount <= 0) return false;
  return force || environment.cookieImportStatus === 'pending' || environment.cookieImportStatus === 'failed';
}

function normalizeSameSite(value: unknown): CdpCookie['sameSite'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'lax') return 'Lax';
  if (normalized === 'none' || normalized === 'no_restriction') return 'None';
  return undefined;
}

function expiresToUnixSeconds(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  if (typeof value !== 'string') return undefined;
  if (/^\d+$/.test(value)) {
    const parsed = Number(value);
    return parsed > 10_000_000_000 ? Math.floor(parsed / 1000) : parsed;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : undefined;
}

function normalizePlatformUrl(platformDomain: string): string | undefined {
  const trimmed = platformDomain.trim();
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    url.pathname = url.pathname === '/' ? '/' : url.pathname;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function buildCdpCookies(environment: EnvironmentListItem): CdpCookie[] {
  const parsed = JSON.parse(environment.cookieRaw) as MoreLoginCookie[];
  if (!Array.isArray(parsed)) throw new Error('Cookie field is not a JSON array');
  const fallbackUrl = normalizePlatformUrl(environment.platformDomain);

  return parsed
    .filter((cookie) => cookie && typeof cookie.name === 'string' && typeof cookie.value === 'string')
    .map((cookie) => {
      const cdpCookie: CdpCookie = {
        name: cookie.name,
        value: cookie.value,
        path: cookie.path || '/',
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.http_only),
      };

      if (cookie.domain) {
        cdpCookie.domain = cookie.domain;
      } else if (fallbackUrl) {
        cdpCookie.url = fallbackUrl;
      }

      const expires = expiresToUnixSeconds(cookie.expires);
      if (expires !== undefined) cdpCookie.expires = expires;

      const sameSite = normalizeSameSite(cookie.same_site);
      if (sameSite) cdpCookie.sameSite = sameSite;

      return cdpCookie;
    })
    .filter((cookie) => cookie.domain || cookie.url);
}

export async function importCookiesIntoBrowser(
  environment: EnvironmentListItem,
  transport: CookieImportTransport,
  options: { force?: boolean } = {},
): Promise<CookieImportResult> {
  if (!shouldImportCookies(environment, options.force ?? false)) {
    return {
      status: 'skipped',
      environmentId: environment.environmentId,
      importedCount: 0,
      message: environment.cookieImportStatus === 'imported' ? 'Cookie 已导入过，本次启动不重复覆盖。' : '该环境没有可导入 Cookie。',
    };
  }

  const cookies = buildCdpCookies(environment);
  if (cookies.length === 0) {
    return {
      status: 'failed',
      environmentId: environment.environmentId,
      importedCount: 0,
      message: 'Cookie JSON 中没有可用于 Chromium 的有效 Cookie。',
    };
  }

  await transport.setCookies(cookies);
  return {
    status: 'imported',
    environmentId: environment.environmentId,
    importedCount: cookies.length,
    message: `已导入 ${cookies.length} 个 Cookie。`,
  };
}

import { describe, expect, it } from 'vitest';
import { buildCdpCookies, shouldImportCookies } from '../src/main/cookie-importer';
import type { EnvironmentListItem } from '../src/shared/store-types';

function makeEnv(overrides: Partial<EnvironmentListItem> = {}): EnvironmentListItem {
  return {
    environmentId: 'env_000001',
    importOrder: 1,
    profileName: 'alpha@example.com',
    platform: 'Google Accounts',
    platformDomain: 'https://accounts.google.com',
    loginAccount: 'alpha@example.com',
    sourceProfileId: '1000000000000000001',
    proxyRaw: '',
    proxyHost: '',
    proxyPort: null,
    proxyNumber: '',
    profileGroup: '',
    profileTag: '',
    profileNote: '',
    userAgent: 'Mozilla/5.0 Chrome/140.0.0.0',
    cookieCount: 1,
    cookieRaw: '[{"name":"sid","value":"fake","domain":".example.com","path":"/","secure":true,"http_only":true,"expires":"2030-01-01T00:00:00.000Z","same_site":"Lax"}]',
    cookieImportStatus: 'pending',
    cookieImportedAt: null,
    cookieImportError: '',
    status: 'stopped',
    ...overrides,
  };
}

describe('cookie importer', () => {
  it('imports cookies only when raw cookies exist and the environment is still pending', () => {
    expect(shouldImportCookies(makeEnv())).toBe(true);
    expect(shouldImportCookies(makeEnv({ cookieImportStatus: 'imported' }))).toBe(false);
    expect(shouldImportCookies(makeEnv({ cookieRaw: '[]', cookieCount: 0 }))).toBe(false);
    expect(shouldImportCookies(makeEnv({ cookieRaw: '', cookieCount: 0 }))).toBe(false);
  });

  it('normalizes MoreLogin cookies into CDP-compatible cookies', () => {
    const cookies = buildCdpCookies(makeEnv());

    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({
      name: 'sid',
      value: 'fake',
      domain: '.example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    });
    expect(cookies[0].expires).toBe(1893456000);
  });

  it('uses the platform domain as a cookie URL when a cookie has no domain', () => {
    const cookies = buildCdpCookies(makeEnv({
      platformDomain: 'accounts.google.com',
      cookieRaw: '[{"name":"session","value":"abc","path":"/"}]',
    }));

    expect(cookies[0]).toMatchObject({
      name: 'session',
      value: 'abc',
      url: 'https://accounts.google.com/',
    });
  });
});

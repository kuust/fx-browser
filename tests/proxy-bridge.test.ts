import { describe, expect, it } from 'vitest';
import type { EnvironmentListItem } from '../src/shared/store-types';
import { buildProxyBridgePlan, parseProxyCredentialFromRaw } from '../src/main/proxy-bridge';

function env(overrides: Partial<EnvironmentListItem> = {}): EnvironmentListItem {
  return {
    environmentId: 'env_000042',
    importOrder: 42,
    profileName: 'alpha@example.com',
    platform: 'Google Accounts',
    platformDomain: 'https://accounts.google.com',
    loginAccount: 'alpha@example.com',
    sourceProfileId: '1000000000000000042',
    proxyRaw: 'socks5://43.251.17.161:20000:user_name:pass_word',
    proxyHost: '43.251.17.161',
    proxyPort: 20000,
    proxyNumber: '42',
    profileGroup: '',
    profileTag: '',
    profileNote: '',
    userAgent: 'Mozilla/5.0 Chrome/140.0.0.0',
    cookieCount: 1,
    cookieRaw: '[{"name":"sid","value":"fake","domain":".example.com"}]',
    cookieImportStatus: 'pending',
    cookieImportedAt: null,
    cookieImportError: '',
    status: 'stopped',
    ...overrides,
  };
}

describe('parseProxyCredentialFromRaw', () => {
  it('parses MoreLogin socks5://host:port:username:password format', () => {
    expect(parseProxyCredentialFromRaw('socks5://43.251.17.161:20000:user_name:pass_word')).toEqual({
      scheme: 'socks5',
      host: '43.251.17.161',
      port: 20000,
      username: 'user_name',
      password: 'pass_word',
      requiresAuth: true,
    });
  });

  it('parses standard proxy URL auth format', () => {
    expect(parseProxyCredentialFromRaw('http://user:pass@1.2.3.4:8080')).toEqual({
      scheme: 'http',
      host: '1.2.3.4',
      port: 8080,
      username: 'user',
      password: 'pass',
      requiresAuth: true,
    });
  });
});

describe('buildProxyBridgePlan', () => {
  it('allocates deterministic local proxy port for authenticated upstream proxy', () => {
    const plan = buildProxyBridgePlan({
      environment: env(),
      basePort: 30000,
    });

    expect(plan).toEqual({
      mode: 'bridge',
      environmentId: 'env_000042',
      localHost: '127.0.0.1',
      localPort: 30042,
      browserProxyServer: 'http://127.0.0.1:30042',
      upstream: {
        scheme: 'socks5',
        host: '43.251.17.161',
        port: 20000,
        username: 'user_name',
        password: 'pass_word',
        requiresAuth: true,
      },
    });
  });

  it('uses direct browser proxy when proxy has no username or password', () => {
    const plan = buildProxyBridgePlan({
      environment: env({
        proxyRaw: 'socks5://43.251.17.161:20000',
        proxyHost: '43.251.17.161',
        proxyPort: 20000,
      }),
      basePort: 30000,
    });

    expect(plan.mode).toBe('direct');
    expect(plan.browserProxyServer).toBe('socks5://43.251.17.161:20000');
  });
});

import { describe, expect, it } from 'vitest';
import type { EnvironmentListItem } from '../src/shared/store-types';
import { ProxyChecker } from '../src/main/proxy-checker';

function env(overrides: Partial<EnvironmentListItem> = {}): EnvironmentListItem {
  return {
    environmentId: 'env_000007',
    importOrder: 7,
    profileName: 'alpha@example.com',
    platform: 'Google Accounts',
    platformDomain: 'https://accounts.google.com',
    loginAccount: 'alpha@example.com',
    sourceProfileId: '1000000000000000007',
    proxyRaw: 'socks5://43.251.17.161:20000:user:pass',
    proxyHost: '43.251.17.161',
    proxyPort: 20000,
    proxyNumber: '7',
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

describe('ProxyChecker', () => {
  it('checks an authenticated proxy through local bridge and returns exit IP', async () => {
    const started: string[] = [];
    const stopped: string[] = [];
    const checker = new ProxyChecker({
      startBridge: async (plan) => {
        started.push(`${plan.localHost}:${plan.localPort}`);
        return {
          environmentId: plan.environmentId,
          localProxyUrl: plan.browserProxyServer,
          browserProxyServer: plan.browserProxyServer,
        };
      },
      stopBridge: async (environmentId) => {
        stopped.push(environmentId);
      },
      fetchIp: async (proxyUrl) => ({ ip: '8.8.8.8', proxyUrl }),
    });

    const result = await checker.check(env());

    expect(result).toEqual({
      status: 'ok',
      environmentId: 'env_000007',
      proxyMode: 'bridge',
      proxyServer: 'http://127.0.0.1:30007',
      ip: '8.8.8.8',
      message: '代理检测成功',
    });
    expect(started).toEqual(['127.0.0.1:30007']);
    expect(stopped).toEqual(['env_000007']);
  });

  it('skips environments without proxy', async () => {
    const checker = new ProxyChecker({
      fetchIp: async () => ({ ip: 'unused', proxyUrl: 'unused' }),
    });

    const result = await checker.check(env({ proxyRaw: '', proxyHost: '', proxyPort: null }));

    expect(result.status).toBe('skipped');
    expect(result.message).toBe('该环境没有代理');
  });
});

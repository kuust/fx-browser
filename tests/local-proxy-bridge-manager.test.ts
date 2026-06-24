import { describe, expect, it } from 'vitest';
import type { ProxyBridgePlan } from '../src/main/proxy-bridge';
import { LocalProxyBridgeManager } from '../src/main/local-proxy-bridge-manager';

function bridgePlan(): Extract<ProxyBridgePlan, { mode: 'bridge' }> {
  return {
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
  };
}

describe('LocalProxyBridgeManager', () => {
  it('creates an anonymized local proxy for an authenticated upstream proxy', async () => {
    const calls: string[] = [];
    const manager = new LocalProxyBridgeManager({
      anonymizeProxy: async (options) => {
        const proxyUrl = typeof options === 'string' ? options : options.url;
        const port = typeof options === 'string' ? undefined : options.port;
        calls.push(`${proxyUrl}|${port}`);
        return 'http://127.0.0.1:30042';
      },
      closeAnonymizedProxy: async () => undefined,
    });

    const result = await manager.start(bridgePlan());

    expect(result).toEqual({
      environmentId: 'env_000042',
      localProxyUrl: 'http://127.0.0.1:30042',
      browserProxyServer: 'http://127.0.0.1:30042',
    });
    expect(calls).toEqual(['socks5://user_name:pass_word@43.251.17.161:20000|30042']);
  });

  it('closes an existing anonymized proxy for an environment', async () => {
    const closed: string[] = [];
    const manager = new LocalProxyBridgeManager({
      anonymizeProxy: async () => 'http://127.0.0.1:30042',
      closeAnonymizedProxy: async (proxyUrl) => {
        closed.push(proxyUrl);
      },
    });

    await manager.start(bridgePlan());
    await manager.stop('env_000042');

    expect(closed).toEqual(['http://127.0.0.1:30042']);
  });
});

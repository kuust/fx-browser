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
  it('starts a chained local proxy through Clash forward proxy when enabled', async () => {
    const started: string[] = [];
    const manager = new LocalProxyBridgeManager({
      forwardProxy: { enabled: true, scheme: 'http', host: '127.0.0.1', port: 7890 },
      startChainedProxy: async (options) => {
        started.push(`${options.forwardProxy.host}:${options.forwardProxy.port}->${options.upstream.scheme}://${options.upstream.host}:${options.upstream.port}@${options.listenPort}`);
        return {
          localProxyUrl: 'http://127.0.0.1:30042',
          close: async () => undefined,
        };
      },
      anonymizeProxy: async () => {
        throw new Error('should not use proxy-chain when forward proxy is enabled');
      },
      closeAnonymizedProxy: async () => undefined,
    });

    const result = await manager.start(bridgePlan());

    expect(result.browserProxyServer).toBe('http://127.0.0.1:30042');
    expect(started).toEqual(['127.0.0.1:7890->socks5://43.251.17.161:20000@30042']);
  });

  it('creates an anonymized local proxy for an authenticated upstream proxy when forward proxy is disabled', async () => {
    const calls: string[] = [];
    const manager = new LocalProxyBridgeManager({
      forwardProxy: null,
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
      forwardProxy: null,
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

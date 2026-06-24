import { anonymizeProxy as defaultAnonymizeProxy, closeAnonymizedProxy as defaultCloseAnonymizedProxy } from 'proxy-chain';
import type { ProxyBridgePlan } from './proxy-bridge.js';
import type { ForwardProxyConfig } from './forward-proxy-config.js';
import { defaultForwardProxyConfig } from './forward-proxy-config.js';
import { startChainedProxyServer, type ChainedProxyServerHandle } from './chained-proxy-server.js';

type BridgeOnlyPlan = Extract<ProxyBridgePlan, { mode: 'bridge' }>;

export type LocalProxyBridgeStartResult = {
  environmentId: string;
  localProxyUrl: string;
  browserProxyServer: string;
};

export type LocalProxyBridgeManagerOptions = {
  anonymizeProxy?: (options: string | { url: string; port: number }) => Promise<string>;
  closeAnonymizedProxy?: (proxyUrl: string, closeConnections?: boolean) => Promise<void>;
  forwardProxy?: ForwardProxyConfig | null;
  startChainedProxy?: typeof startChainedProxyServer;
};

function encodeCredential(value: string): string {
  return encodeURIComponent(value);
}

export function buildUpstreamProxyUrl(plan: BridgeOnlyPlan): string {
  const auth = `${encodeCredential(plan.upstream.username)}:${encodeCredential(plan.upstream.password)}`;
  return `${plan.upstream.scheme}://${auth}@${plan.upstream.host}:${plan.upstream.port}`;
}

export class LocalProxyBridgeManager {
  private readonly anonymizeProxy: (options: string | { url: string; port: number }) => Promise<string>;
  private readonly closeAnonymizedProxy: (proxyUrl: string, closeConnections?: boolean) => Promise<void>;
  private readonly forwardProxy: ForwardProxyConfig | null;
  private readonly startChainedProxy: typeof startChainedProxyServer;
  private readonly active = new Map<string, { url: string; close(): Promise<void> }>();

  constructor(options: LocalProxyBridgeManagerOptions = {}) {
    this.anonymizeProxy = options.anonymizeProxy ?? defaultAnonymizeProxy;
    this.closeAnonymizedProxy = options.closeAnonymizedProxy ?? (async (proxyUrl: string, closeConnections?: boolean): Promise<void> => {
      await defaultCloseAnonymizedProxy(proxyUrl, closeConnections ?? true);
    });
    this.forwardProxy = options.forwardProxy === undefined ? defaultForwardProxyConfig() : options.forwardProxy;
    this.startChainedProxy = options.startChainedProxy ?? startChainedProxyServer;
  }

  async start(plan: BridgeOnlyPlan): Promise<LocalProxyBridgeStartResult> {
    const existing = this.active.get(plan.environmentId);
    if (existing) {
      return {
        environmentId: plan.environmentId,
        localProxyUrl: existing.url,
        browserProxyServer: existing.url,
      };
    }

    if (this.forwardProxy?.enabled) {
      const chained = await this.startChainedProxy({
        listenHost: plan.localHost,
        listenPort: plan.localPort,
        forwardProxy: this.forwardProxy,
        upstream: plan.upstream,
      });
      this.active.set(plan.environmentId, { url: chained.localProxyUrl, close: chained.close });
      return {
        environmentId: plan.environmentId,
        localProxyUrl: chained.localProxyUrl,
        browserProxyServer: chained.localProxyUrl,
      };
    }

    const upstreamProxyUrl = buildUpstreamProxyUrl(plan);
    const localProxyUrl = await this.anonymizeProxy({ url: upstreamProxyUrl, port: plan.localPort });
    this.active.set(plan.environmentId, { url: localProxyUrl, close: () => this.closeAnonymizedProxy(localProxyUrl, true) });
    return {
      environmentId: plan.environmentId,
      localProxyUrl,
      browserProxyServer: localProxyUrl,
    };
  }

  async stop(environmentId: string): Promise<void> {
    const existing = this.active.get(environmentId);
    if (!existing) return;
    this.active.delete(environmentId);
    await existing.close();
  }
}

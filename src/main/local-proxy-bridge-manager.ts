import { anonymizeProxy as defaultAnonymizeProxy, closeAnonymizedProxy as defaultCloseAnonymizedProxy } from 'proxy-chain';
import type { ProxyBridgePlan } from './proxy-bridge.js';

type BridgeOnlyPlan = Extract<ProxyBridgePlan, { mode: 'bridge' }>;

export type LocalProxyBridgeStartResult = {
  environmentId: string;
  localProxyUrl: string;
  browserProxyServer: string;
};

export type LocalProxyBridgeManagerOptions = {
  anonymizeProxy?: (options: string | { url: string; port: number }) => Promise<string>;
  closeAnonymizedProxy?: (proxyUrl: string, closeConnections?: boolean) => Promise<void>;
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
  private readonly active = new Map<string, string>();

  constructor(options: LocalProxyBridgeManagerOptions = {}) {
    this.anonymizeProxy = options.anonymizeProxy ?? defaultAnonymizeProxy;
    this.closeAnonymizedProxy = options.closeAnonymizedProxy ?? (async (proxyUrl: string, closeConnections?: boolean): Promise<void> => {
      await defaultCloseAnonymizedProxy(proxyUrl, closeConnections ?? true);
    });
  }

  async start(plan: BridgeOnlyPlan): Promise<LocalProxyBridgeStartResult> {
    const existing = this.active.get(plan.environmentId);
    if (existing) {
      return {
        environmentId: plan.environmentId,
        localProxyUrl: existing,
        browserProxyServer: existing,
      };
    }

    const upstreamProxyUrl = buildUpstreamProxyUrl(plan);
    const localProxyUrl = await this.anonymizeProxy({ url: upstreamProxyUrl, port: plan.localPort });
    this.active.set(plan.environmentId, localProxyUrl);
    return {
      environmentId: plan.environmentId,
      localProxyUrl,
      browserProxyServer: localProxyUrl,
    };
  }

  async stop(environmentId: string): Promise<void> {
    const localProxyUrl = this.active.get(environmentId);
    if (!localProxyUrl) return;
    this.active.delete(environmentId);
    await this.closeAnonymizedProxy(localProxyUrl, true);
  }
}

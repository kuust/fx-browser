import { ProxyAgent, fetch } from 'undici';
import type { EnvironmentListItem } from '../shared/store-types.js';
import { buildProxyBridgePlan, type ProxyBridgePlan } from './proxy-bridge.js';
import type { LocalProxyBridgeStartResult } from './local-proxy-bridge-manager.js';

type BridgeOnlyPlan = Extract<ProxyBridgePlan, { mode: 'bridge' }>;

export type ProxyCheckResult = {
  status: 'ok' | 'failed' | 'skipped';
  environmentId: string;
  proxyMode: ProxyBridgePlan['mode'];
  proxyServer: string | null;
  ip: string | null;
  message: string;
};

export type ProxyCheckerOptions = {
  startBridge?: (plan: BridgeOnlyPlan) => Promise<LocalProxyBridgeStartResult>;
  stopBridge?: (environmentId: string) => Promise<void>;
  fetchIp?: (proxyUrl: string) => Promise<{ ip: string; proxyUrl: string }>;
};

async function defaultFetchIp(proxyUrl: string): Promise<{ ip: string; proxyUrl: string }> {
  const response = await fetch('https://api.ipify.org?format=json', {
    dispatcher: new ProxyAgent(proxyUrl),
  });
  if (!response.ok) throw new Error(`IP 查询失败：HTTP ${response.status}`);
  const data = await response.json() as { ip?: string };
  if (!data.ip) throw new Error('IP 查询返回为空');
  return { ip: data.ip, proxyUrl };
}

export class ProxyChecker {
  private readonly fetchIp: (proxyUrl: string) => Promise<{ ip: string; proxyUrl: string }>;

  constructor(private readonly options: ProxyCheckerOptions = {}) {
    this.fetchIp = options.fetchIp ?? defaultFetchIp;
  }

  async check(environment: EnvironmentListItem): Promise<ProxyCheckResult> {
    const plan = buildProxyBridgePlan({ environment });
    if (plan.mode === 'none' || !plan.browserProxyServer) {
      return {
        status: 'skipped',
        environmentId: environment.environmentId,
        proxyMode: 'none',
        proxyServer: null,
        ip: null,
        message: '该环境没有代理',
      };
    }

    let proxyServer = plan.browserProxyServer;
    let shouldStopBridge = false;

    try {
      if (plan.mode === 'bridge') {
        const bridge = await this.options.startBridge?.(plan);
        proxyServer = bridge?.browserProxyServer ?? plan.browserProxyServer;
        shouldStopBridge = true;
      }

      const result = await this.fetchIp(proxyServer);
      return {
        status: 'ok',
        environmentId: environment.environmentId,
        proxyMode: plan.mode,
        proxyServer,
        ip: result.ip,
        message: '代理检测成功',
      };
    } catch (error) {
      return {
        status: 'failed',
        environmentId: environment.environmentId,
        proxyMode: plan.mode,
        proxyServer,
        ip: null,
        message: (error as Error).message,
      };
    } finally {
      if (shouldStopBridge) {
        await this.options.stopBridge?.(environment.environmentId);
      }
    }
  }
}

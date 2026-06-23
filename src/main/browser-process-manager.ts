import { mkdirSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import type { EnvironmentListItem } from '../shared/store-types.js';
import { buildBrowserLaunchPlan } from './browser-launcher.js';
import { buildProxyBridgePlan, type ProxyBridgePlan } from './proxy-bridge.js';

export type BrowserProcessResult = {
  status: 'started' | 'already-running' | 'stopped' | 'not-running';
  environmentId: string;
  message?: string;
};

export type BrowserProcessManagerOptions = {
  appUserDataDir: string;
  executablePathProvider: () => string | null;
  spawnBrowser?: (executablePath: string, args: string[]) => ChildProcess;
  startProxyBridge?: (plan: Extract<ProxyBridgePlan, { mode: 'bridge' }>) => unknown | Promise<unknown>;
  stopProxyBridge?: (environmentId: string) => void;
  markStatus: (environmentId: string, status: EnvironmentListItem['status']) => void;
};

export class BrowserProcessManager {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly spawnBrowser: (executablePath: string, args: string[]) => ChildProcess;

  constructor(private readonly options: BrowserProcessManagerOptions) {
    this.spawnBrowser = options.spawnBrowser ?? ((executablePath, args) => spawn(executablePath, args, {
      detached: false,
      stdio: 'ignore',
    }));
  }

  async start(environment: EnvironmentListItem): Promise<BrowserProcessResult> {
    if (this.processes.has(environment.environmentId)) {
      return { status: 'already-running', environmentId: environment.environmentId };
    }

    const executablePath = this.options.executablePathProvider();
    if (!executablePath) {
      throw new Error('未找到本机 Chrome 或 Edge，请先安装 Chrome/Edge，后续版本会支持手动选择内核路径。');
    }

    const proxyPlan = buildProxyBridgePlan({ environment });
    if (proxyPlan.mode === 'bridge') {
      await this.options.startProxyBridge?.(proxyPlan);
    }

    const plan = buildBrowserLaunchPlan({
      executablePath,
      appUserDataDir: this.options.appUserDataDir,
      environment,
      browserProxyServer: proxyPlan.browserProxyServer,
    });

    mkdirSync(plan.profileUserDataDir, { recursive: true });
    const child = this.spawnBrowser(plan.executablePath, plan.args);
    this.processes.set(environment.environmentId, child);
    this.options.markStatus(environment.environmentId, 'running');

    child.once('exit', () => {
      this.processes.delete(environment.environmentId);
      this.options.stopProxyBridge?.(environment.environmentId);
      this.options.markStatus(environment.environmentId, 'stopped');
    });

    return { status: 'started', environmentId: environment.environmentId };
  }

  stop(environmentId: string): BrowserProcessResult {
    const child = this.processes.get(environmentId);
    if (!child) return { status: 'not-running', environmentId };
    child.kill();
    this.processes.delete(environmentId);
    this.options.stopProxyBridge?.(environmentId);
    this.options.markStatus(environmentId, 'stopped');
    return { status: 'stopped', environmentId };
  }

  isRunning(environmentId: string): boolean {
    return this.processes.has(environmentId);
  }
}

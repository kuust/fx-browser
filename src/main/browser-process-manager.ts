import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { EnvironmentListItem } from '../shared/store-types.js';
import { buildBrowserLaunchPlan } from './browser-launcher.js';
import { buildProxyBridgePlan, type ProxyBridgePlan } from './proxy-bridge.js';
import { CdpCookieTransport } from './cdp-cookie-transport.js';
import { importCookiesIntoBrowser, type CdpCookie, type CookieImportResult } from './cookie-importer.js';
import type { LocalProxyBridgeStartResult } from './local-proxy-bridge-manager.js';

export type BrowserProcessResult = {
  status: 'started' | 'already-running' | 'stopped' | 'not-running';
  environmentId: string;
  message?: string;
};

export type BrowserProcessManagerOptions = {
  appUserDataDir: string;
  executablePathProvider: () => string | null;
  spawnBrowser?: (executablePath: string, args: string[]) => ChildProcess;
  startProxyBridge?: (plan: Extract<ProxyBridgePlan, { mode: 'bridge' }>) => LocalProxyBridgeStartResult | void | Promise<LocalProxyBridgeStartResult | void>;
  stopProxyBridge?: (environmentId: string) => void;
  markStatus: (environmentId: string, status: EnvironmentListItem['status']) => void;
  markCookieImportResult?: (environmentId: string, result: CookieImportResult) => void;
  cookieImportDelayMs?: number;
  createCookieTransport?: (debuggingPort: number) => { setCookies(cookies: CdpCookie[]): Promise<void> };
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

  private debuggingPortFor(environmentId: string): number {
    const match = environmentId.match(/(\d+)$/);
    const numericId = match ? Number(match[1]) : 0;
    return 40_000 + (numericId % 10_000);
  }

  private titleExtensionPathFor(environment: EnvironmentListItem): string {
    const extensionDir = path.join(this.options.appUserDataDir, 'profiles', environment.environmentId, 'fixed_title_extension');
    mkdirSync(extensionDir, { recursive: true });
    const title = JSON.stringify(environment.profileName || environment.environmentId);
    writeFileSync(path.join(extensionDir, 'manifest.json'), JSON.stringify({
      manifest_version: 3,
      name: 'FX Browser Fixed Environment Title',
      version: '1.0.0',
      content_scripts: [{
        matches: ['<all_urls>'],
        js: ['title.js'],
        run_at: 'document_idle',
        all_frames: false,
      }],
    }, null, 2));
    writeFileSync(path.join(extensionDir, 'title.js'), `(() => {\n  const fixedTitle = ${title};\n  const apply = () => { if (document.title !== fixedTitle) document.title = fixedTitle; };\n  apply();\n  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });\n  setInterval(apply, 1000);\n})();\n`);
    return extensionDir;
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
    let browserProxyServer = proxyPlan.browserProxyServer;
    if (proxyPlan.mode === 'bridge') {
      const bridgeResult = await this.options.startProxyBridge?.(proxyPlan);
      browserProxyServer = bridgeResult?.browserProxyServer ?? proxyPlan.browserProxyServer;
    }

    const remoteDebuggingPort = this.debuggingPortFor(environment.environmentId);
    const plan = buildBrowserLaunchPlan({
      executablePath,
      appUserDataDir: this.options.appUserDataDir,
      environment,
      browserProxyServer,
      remoteDebuggingPort,
      titleExtensionPath: this.titleExtensionPathFor(environment),
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

    if (environment.cookieImportStatus === 'pending' || environment.cookieImportStatus === 'failed') {
      const delayMs = this.options.cookieImportDelayMs ?? 2_000;
      setTimeout(() => {
        const transport = this.options.createCookieTransport?.(remoteDebuggingPort) ?? new CdpCookieTransport({ debuggingPort: remoteDebuggingPort });
        void importCookiesIntoBrowser(environment, transport)
          .then((cookieResult) => this.options.markCookieImportResult?.(environment.environmentId, cookieResult))
          .catch((error) => this.options.markCookieImportResult?.(environment.environmentId, {
            status: 'failed',
            environmentId: environment.environmentId,
            importedCount: 0,
            message: (error as Error).message,
          }));
      }, delayMs);
    }

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

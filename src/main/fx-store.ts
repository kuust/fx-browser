import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { MoreLoginImportReport } from '../shared/import-types.js';
import type { BrowserEnvDraft, EnvironmentListItem, ProxyListItem, SavedImportSummary } from '../shared/store-types.js';

type StoreFile = {
  version: 2;
  lastImport: SavedImportSummary | null;
  environments: EnvironmentListItem[];
  proxies: ProxyListItem[];
  environmentDraft: BrowserEnvDraft;
};

const DEFAULT_ENVIRONMENT_DRAFT: BrowserEnvDraft = {
  environmentName: '',
  browserType: 'ChromeBrowser',
  operatingSystem: 'Windows',
  userAgentMode: 'default',
  userAgent: '',
  proxyType: 'Socks5',
  proxyChannel: 'IP2Location',
  proxyServer: '',
  proxyAccount: '',
  proxyPassword: '',
  refreshUrl: '',
  ipChangeMonitor: false,
  proxyMode: 'custom',
  accountCookie: '',
  openUrl: '',
  languageMode: 'ip',
  timezoneMode: 'ip',
  geolocationMode: 'ask',
  resolution: 'default',
  fontListMode: 'real',
  fontProtection: 'noise',
  webrtc: 'disable',
  canvas: 'noise',
  webglImage: 'noise',
  webglInfo: 'ua',
  webgpu: 'match-webgl',
  audioContext: 'noise',
  speechVoices: 'enable',
  hardwareSettings: 'noise',
  hardwareConcurrency: '12',
  deviceMemory: '8',
  doNotTrack: 'default',
  battery: 'noise',
  portScanProtection: 'enable',
  pageTlsProtocol: 'default',
  startupArgs: '',
  cookieIsolation: 'default',
  multiOpen: 'browser-default',
  webNotification: 'ask',
  clipboardProtection: 'browser-default',
};

const STORE_FILE_NAME = 'fx-browser-store.json';

function environmentIdFromOrder(importOrder: number): string {
  return `env_${String(importOrder).padStart(6, '0')}`;
}

function emptyStore(): StoreFile {
  return {
    version: 2,
    lastImport: null,
    environments: [],
    proxies: [],
    environmentDraft: DEFAULT_ENVIRONMENT_DRAFT,
  };
}

export class FxBrowserStore {
  private readonly storePath: string;

  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.storePath = path.join(dataDir, STORE_FILE_NAME);
    if (!existsSync(this.storePath)) {
      this.writeStore(emptyStore());
    }
  }

  saveMoreLoginImport(report: MoreLoginImportReport, sourceFileName: string): SavedImportSummary {
    const summary: SavedImportSummary = {
      sourceFileName,
      importedAt: new Date().toISOString(),
      totalProfiles: report.totalProfiles,
      cookieParseSuccess: report.cookieParseSuccess,
      cookieParseFailed: report.cookieParseFailed,
      proxyParseSuccess: report.proxyParseSuccess,
      proxyEmpty: report.proxyEmpty,
      warnings: report.warnings,
    };

    const environments = report.profiles
      .slice()
      .sort((a, b) => a.importOrder - b.importOrder)
      .map<EnvironmentListItem>((profile) => ({
        environmentId: environmentIdFromOrder(profile.importOrder),
        importOrder: profile.importOrder,
        profileName: profile.profileName,
        platform: profile.platform,
        platformDomain: profile.userDefinedPlatformDomainName,
        loginAccount: profile.loginAccount,
        sourceProfileId: profile.sourceProfileId,
        proxyRaw: profile.proxyInformationRaw,
        proxyHost: profile.proxy?.host ?? '',
        proxyPort: profile.proxy?.port ?? null,
        proxyNumber: profile.proxyNumber,
        profileGroup: profile.profileGroup,
        profileTag: profile.profileTag,
        profileNote: profile.profileNote,
        userAgent: profile.userAgent,
        cookieCount: profile.cookieCount,
        cookieRaw: profile.cookieRaw,
        cookieImportStatus: profile.cookieCount > 0 ? 'pending' : 'none',
        cookieImportedAt: null,
        cookieImportError: '',
        status: 'stopped',
      }));

    this.writeStore({
      version: 2,
      lastImport: summary,
      environments,
      proxies: this.proxiesFromEnvironments(environments),
      environmentDraft: this.getEnvironmentDraft(),
    });

    return summary;
  }

  listEnvironments(): EnvironmentListItem[] {
    return this.readStore().environments.slice().sort((a, b) => a.importOrder - b.importOrder);
  }

  getLastImportSummary(): SavedImportSummary | null {
    return this.readStore().lastImport;
  }

  markEnvironmentStatus(environmentId: string, status: EnvironmentListItem['status']): void {
    const store = this.readStore();
    const environment = store.environments.find((item) => item.environmentId === environmentId);
    if (!environment) throw new Error(`Environment not found: ${environmentId}`);
    environment.status = status;
    this.writeStore(store);
  }

  markCookieImportResult(environmentId: string, result: { status: 'imported' | 'skipped' | 'failed'; message: string }): void {
    const store = this.readStore();
    const environment = store.environments.find((item) => item.environmentId === environmentId);
    if (!environment) throw new Error(`Environment not found: ${environmentId}`);
    if (result.status === 'imported') {
      environment.cookieImportStatus = 'imported';
      environment.cookieImportedAt = new Date().toISOString();
      environment.cookieImportError = '';
    } else if (result.status === 'failed') {
      environment.cookieImportStatus = 'failed';
      environment.cookieImportError = result.message;
    }
    this.writeStore(store);
  }

  resetCookieImport(environmentId: string): void {
    const store = this.readStore();
    const environment = store.environments.find((item) => item.environmentId === environmentId);
    if (!environment) throw new Error(`Environment not found: ${environmentId}`);
    environment.cookieImportStatus = environment.cookieCount > 0 ? 'pending' : 'none';
    environment.cookieImportedAt = null;
    environment.cookieImportError = '';
    this.writeStore(store);
  }

  getEnvironment(environmentId: string): EnvironmentListItem | null {
    return this.readStore().environments.find((item) => item.environmentId === environmentId) ?? null;
  }

  listProxies(): ProxyListItem[] {
    return this.readStore().proxies.slice().sort((a, b) => a.importOrder - b.importOrder);
  }

  saveProxies(proxies: ProxyListItem[]): void {
    const store = this.readStore();
    store.proxies = proxies.slice().sort((a, b) => a.importOrder - b.importOrder);
    this.writeStore(store);
  }

  upsertProxy(proxy: ProxyListItem): void {
    const store = this.readStore();
    const index = store.proxies.findIndex((item) => item.proxyId === proxy.proxyId);
    if (index >= 0) store.proxies[index] = proxy;
    else store.proxies.push(proxy);
    store.proxies.sort((a, b) => a.importOrder - b.importOrder);
    this.writeStore(store);
  }

  getEnvironmentDraft(): BrowserEnvDraft {
    return { ...DEFAULT_ENVIRONMENT_DRAFT, ...this.readStore().environmentDraft };
  }

  saveEnvironmentDraft(draft: BrowserEnvDraft): void {
    const store = this.readStore();
    store.environmentDraft = { ...DEFAULT_ENVIRONMENT_DRAFT, ...draft };
    this.writeStore(store);
  }

  private proxiesFromEnvironments(environments: EnvironmentListItem[]): ProxyListItem[] {
    return environments
      .filter((environment) => environment.proxyHost || environment.proxyRaw)
      .map<ProxyListItem>((environment) => ({
        proxyId: `proxy_${String(environment.importOrder).padStart(6, '0')}`,
        importOrder: environment.importOrder,
        proxyType: environment.proxyRaw.match(/^(https?|socks5):\/\//i)?.[1]?.toUpperCase() ?? 'SOCKS5',
        proxyHost: environment.proxyHost,
        proxyPort: environment.proxyPort,
        proxyAccount: '',
        proxyPassword: '',
        refreshUrl: '',
        proxyGroup: environment.profileGroup,
        proxyName: environment.proxyNumber || environment.profileName || environment.environmentId,
        ipQueryChannel: 'IP2Location',
        status: 'pending',
        lastCheckedIp: '',
        lastCheckedAt: null,
      }));
  }

  private readStore(): StoreFile {
    const raw = JSON.parse(readFileSync(this.storePath, 'utf8')) as Partial<StoreFile> & {
      version?: number;
      lastImport: SavedImportSummary | null;
      environments: EnvironmentListItem[];
    };
    return {
      version: 2,
      lastImport: raw.lastImport ?? null,
      environments: raw.environments ?? [],
      proxies: raw.proxies ?? this.proxiesFromEnvironments(raw.environments ?? []),
      environmentDraft: { ...DEFAULT_ENVIRONMENT_DRAFT, ...(raw.environmentDraft ?? {}) },
    };
  }

  private writeStore(store: StoreFile): void {
    writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}

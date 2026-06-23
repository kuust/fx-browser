import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { MoreLoginImportReport } from '../shared/import-types.js';
import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types.js';

type StoreFile = {
  version: 1;
  lastImport: SavedImportSummary | null;
  environments: EnvironmentListItem[];
};

const STORE_FILE_NAME = 'fx-browser-store.json';

function environmentIdFromOrder(importOrder: number): string {
  return `env_${String(importOrder).padStart(6, '0')}`;
}

function emptyStore(): StoreFile {
  return {
    version: 1,
    lastImport: null,
    environments: [],
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
      version: 1,
      lastImport: summary,
      environments,
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

  private readStore(): StoreFile {
    return JSON.parse(readFileSync(this.storePath, 'utf8')) as StoreFile;
  }

  private writeStore(store: StoreFile): void {
    writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}

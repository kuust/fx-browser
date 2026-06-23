import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types';

type ImportMoreLoginUiResult =
  | { canceled: true }
  | { canceled: false; summary: SavedImportSummary; environments: EnvironmentListItem[] };

type EnvironmentActionResult = {
  status: 'started' | 'already-running' | 'stopped' | 'not-running';
  environmentId: string;
  message?: string;
  environments: EnvironmentListItem[];
};

type ProxyCheckUiResult = {
  status: 'ok' | 'failed' | 'skipped';
  environmentId: string;
  proxyMode: 'none' | 'direct' | 'bridge';
  proxyServer: string | null;
  ip: string | null;
  message: string;
};

declare global {
  interface Window {
    fxBrowser: {
      listEnvironments: () => Promise<EnvironmentListItem[]>;
      getLastImportSummary: () => Promise<SavedImportSummary | null>;
      importMoreLoginFile: () => Promise<ImportMoreLoginUiResult>;
      startEnvironment: (environmentId: string) => Promise<EnvironmentActionResult>;
      stopEnvironment: (environmentId: string) => Promise<EnvironmentActionResult>;
      checkProxy: (environmentId: string) => Promise<ProxyCheckUiResult>;
    };
  }
}

export {};

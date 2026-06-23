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

declare global {
  interface Window {
    fxBrowser: {
      listEnvironments: () => Promise<EnvironmentListItem[]>;
      getLastImportSummary: () => Promise<SavedImportSummary | null>;
      importMoreLoginFile: () => Promise<ImportMoreLoginUiResult>;
      startEnvironment: (environmentId: string) => Promise<EnvironmentActionResult>;
      stopEnvironment: (environmentId: string) => Promise<EnvironmentActionResult>;
    };
  }
}

export {};

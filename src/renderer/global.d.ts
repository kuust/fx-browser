import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types';

type ImportMoreLoginUiResult =
  | { canceled: true }
  | { canceled: false; summary: SavedImportSummary; environments: EnvironmentListItem[] };

declare global {
  interface Window {
    fxBrowser: {
      listEnvironments: () => Promise<EnvironmentListItem[]>;
      getLastImportSummary: () => Promise<SavedImportSummary | null>;
      importMoreLoginFile: () => Promise<ImportMoreLoginUiResult>;
    };
  }
}

export {};

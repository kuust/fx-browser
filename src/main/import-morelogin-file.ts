import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FxBrowserStore } from './fx-store.js';
import { parseMoreLoginExportText } from './morelogin-importer.js';
import type { EnvironmentListItem, SavedImportSummary } from '../shared/store-types.js';

export type ImportMoreLoginFileResult = {
  summary: SavedImportSummary;
  environments: EnvironmentListItem[];
};

export function importMoreLoginFile(filePath: string, store: FxBrowserStore): ImportMoreLoginFileResult {
  const text = readFileSync(filePath, 'utf8');
  const report = parseMoreLoginExportText(text);
  const summary = store.saveMoreLoginImport(report, path.basename(filePath));
  const environments = store.listEnvironments();
  return { summary, environments };
}

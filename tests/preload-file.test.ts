import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('packaged preload loading', () => {
  const mainSource = readFileSync(path.join(process.cwd(), 'src/main/main.ts'), 'utf8');
  const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  const preloadSource = readFileSync(path.join(process.cwd(), 'src/main/preload.cjs'), 'utf8');

  it('uses a CommonJS preload file so Electron can load the bridge in packaged Windows builds', () => {
    expect(mainSource).toContain("preload.cjs");
    expect(preloadSource).toContain("require('electron')");
    expect(preloadSource).toContain("exposeInMainWorld('fxBrowser'");
    expect(preloadSource).toContain("exposeInMainWorld('electronAPI'");
    expect(preloadSource).toContain('importMoreLoginFile');
  });

  it('copies the CommonJS preload into dist-electron during the Electron build step', () => {
    expect(packageJson.scripts['build:main']).toContain('copy-preload.mjs');
  });
});

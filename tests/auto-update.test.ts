import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('auto update support', () => {
  const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const builderConfig = readFileSync(path.join(process.cwd(), 'electron-builder.yml'), 'utf8');
  const mainSource = readFileSync(path.join(process.cwd(), 'src/main/main.ts'), 'utf8');
  const appSource = readFileSync(path.join(process.cwd(), 'src/renderer/App.tsx'), 'utf8');
  const workflow = readFileSync(path.join(process.cwd(), '.github/workflows/windows-build.yml'), 'utf8');

  it('uses electron-updater from the main process instead of only opening a release page', () => {
    expect(packageJson.dependencies).toHaveProperty('electron-updater');
    expect(mainSource).toContain("from 'electron-updater'");
    expect(mainSource).toContain("ipcMain.handle('fx:download-update'");
    expect(mainSource).toContain("ipcMain.handle('fx:install-update'");
  });

  it('publishes GitHub release metadata required by NSIS auto updates', () => {
    expect(builderConfig).toContain('publish:');
    expect(builderConfig).toContain('provider: github');
    expect(builderConfig).toContain('owner: kuust');
    expect(builderConfig).toContain('repo: fx-browser');
    expect(workflow).toContain('release/*.yml');
  });

  it('lets the settings page download and install updates from the client', () => {
    expect(appSource).toContain('downloadUpdate');
    expect(appSource).toContain('installUpdate');
    expect(appSource).toContain('下载并安装更新');
  });

  it('can publish a GitHub Release from the Windows build workflow', () => {
    expect(workflow).toContain('GH_TOKEN');
    expect(workflow).toContain('--publish always');
    expect(workflow).toContain('release/*.yml');
  });
});

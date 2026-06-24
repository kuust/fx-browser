import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('fingerprint Chromium packaging', () => {
  it('packages runtime as extraResources outside app asar', () => {
    const config = readFileSync(path.join(process.cwd(), 'electron-builder.yml'), 'utf8');
    expect(config).toContain('extraResources:');
    expect(config).toContain('runtime/fingerprint-chromium');
    expect(config).toContain('to: fingerprint-chromium');
  });

  it('prepares fingerprint Chromium before the Windows installer build in CI', () => {
    const workflow = readFileSync(path.join(process.cwd(), '.github/workflows/windows-build.yml'), 'utf8');
    expect(workflow).toContain('npm run prepare:fingerprint-chromium');
    expect(workflow.indexOf('npm run prepare:fingerprint-chromium')).toBeLessThan(workflow.indexOf('npm run package:win'));
  });
});

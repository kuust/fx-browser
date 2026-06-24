import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('preload API bridge', () => {
  const preloadSource = readFileSync(path.join(process.cwd(), 'src/main/preload.ts'), 'utf8');

  it('exposes the MoreLogin import API on the legacy electronAPI bridge used by older renderer builds', () => {
    expect(preloadSource).toContain('importMoreLoginFile');
    expect(preloadSource).toContain("exposeInMainWorld('electronAPI', bridgeApi)");
  });

  it('keeps the current fxBrowser bridge available for the renderer', () => {
    expect(preloadSource).toContain('importMoreLoginFile');
    expect(preloadSource).toContain("exposeInMainWorld('fxBrowser', bridgeApi)");
  });
});

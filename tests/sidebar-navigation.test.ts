import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('sidebar navigation wiring', () => {
  const appSource = readFileSync(path.join(process.cwd(), 'src/renderer/App.tsx'), 'utf8');

  it('tracks active sidebar section in state instead of rendering inert links', () => {
    expect(appSource).toContain('activeSection');
    expect(appSource).toContain('setActiveSection');
  });

  it('wires MoreLogin import, proxy check, cookie status, and settings menu items to click handlers', () => {
    expect(appSource).toMatch(/onClick=\{\(\) => setActiveSection\('import'\)\}/);
    expect(appSource).toMatch(/onClick=\{\(\) => setActiveSection\('proxy'\)\}/);
    expect(appSource).toMatch(/onClick=\{\(\) => setActiveSection\('cookies'\)\}/);
    expect(appSource).toMatch(/onClick=\{\(\) => setActiveSection\('settings'\)\}/);
  });
});

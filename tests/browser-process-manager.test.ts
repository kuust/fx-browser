import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import type { EnvironmentListItem } from '../src/shared/store-types';
import { BrowserProcessManager } from '../src/main/browser-process-manager';

function makeEnv(): EnvironmentListItem {
  return {
    environmentId: 'env_000001',
    importOrder: 1,
    profileName: 'alpha@example.com',
    platform: 'Google Accounts',
    platformDomain: 'https://accounts.google.com',
    loginAccount: 'alpha@example.com',
    sourceProfileId: '1000000000000000001',
    proxyRaw: '',
    proxyHost: '',
    proxyPort: null,
    proxyNumber: '',
    profileGroup: '',
    profileTag: '',
    profileNote: '',
    userAgent: 'Mozilla/5.0 Chrome/140.0.0.0',
    cookieCount: 1,
    cookieRaw: '[{"name":"sid","value":"fake","domain":".example.com"}]',
    cookieImportStatus: 'pending',
    cookieImportedAt: null,
    cookieImportError: '',
    status: 'stopped',
  };
}

describe('BrowserProcessManager', () => {
  it('spawns a browser launch plan once and reports running state', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-process-'));
    const spawned: Array<{ executablePath: string; args: string[] }> = [];
    const fakeProcess = {
      once: () => fakeProcess,
      kill: () => true,
    } as unknown as ChildProcess;

    try {
      const manager = new BrowserProcessManager({
        appUserDataDir: dir,
        executablePathProvider: () => 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        spawnBrowser: (executablePath, args) => {
          spawned.push({ executablePath, args });
          return fakeProcess;
        },
        markStatus: () => undefined,
      });

      const result = await manager.start(makeEnv());

      expect(result.status).toBe('started');
      expect(manager.isRunning('env_000001')).toBe(true);
      expect(spawned).toHaveLength(1);
      expect(spawned[0].executablePath).toContain('chrome.exe');
      expect(spawned[0].args).toContain('--new-window');
      expect(spawned[0].args).toContain('--remote-debugging-port=40001');
      expect(spawned[0].args).toContain('https://accounts.google.com/');

      const second = await manager.start(makeEnv());
      expect(second.status).toBe('already-running');
      expect(spawned).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stops a running browser process', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-process-'));
    let killed = false;
    const fakeProcess = {
      once: () => fakeProcess,
      kill: () => {
        killed = true;
        return true;
      },
    } as unknown as ChildProcess;

    try {
      const manager = new BrowserProcessManager({
        appUserDataDir: dir,
        executablePathProvider: () => 'chrome.exe',
        spawnBrowser: () => fakeProcess,
        markStatus: () => undefined,
      });

      await manager.start(makeEnv());
      const result = manager.stop('env_000001');

      expect(result.status).toBe('stopped');
      expect(killed).toBe(true);
      expect(manager.isRunning('env_000001')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('starts a local proxy bridge for authenticated proxies before launching browser', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-process-'));
    const spawned: Array<{ executablePath: string; args: string[] }> = [];
    const bridges: string[] = [];
    const fakeProcess = {
      once: () => fakeProcess,
      kill: () => true,
    } as unknown as ChildProcess;

    try {
      const manager = new BrowserProcessManager({
        appUserDataDir: dir,
        executablePathProvider: () => 'chrome.exe',
        spawnBrowser: (executablePath, args) => {
          spawned.push({ executablePath, args });
          return fakeProcess;
        },
        startProxyBridge: (plan) => {
          bridges.push(`${plan.localHost}:${plan.localPort}->${plan.upstream.host}:${plan.upstream.port}`);
        },
        markStatus: () => undefined,
      });

      await manager.start({
        ...makeEnv(),
        proxyRaw: 'socks5://43.251.17.161:20000:user:pass',
        proxyHost: '43.251.17.161',
        proxyPort: 20000,
      });

      expect(bridges).toEqual(['127.0.0.1:30001->43.251.17.161:20000']);
      expect(spawned[0].args).toContain('--proxy-server=http://127.0.0.1:30001');
      expect(spawned[0].args).not.toContain('--proxy-server=socks5://43.251.17.161:20000');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('imports pending cookies after first launch and records imported status without blocking launch', async () => {
    vi.useFakeTimers();
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-process-'));
    const imported: unknown[] = [];
    const cookieStatuses: string[] = [];
    const fakeProcess = {
      once: () => fakeProcess,
      kill: () => true,
    } as unknown as ChildProcess;

    try {
      const manager = new BrowserProcessManager({
        appUserDataDir: dir,
        executablePathProvider: () => 'chrome.exe',
        spawnBrowser: () => fakeProcess,
        createCookieTransport: () => ({
          setCookies: async (cookies) => {
            imported.push(...cookies);
          },
        }),
        markCookieImportResult: (_environmentId, result) => {
          cookieStatuses.push(result.status);
        },
        markStatus: () => undefined,
        cookieImportDelayMs: 10,
      });

      const result = await manager.start(makeEnv());
      expect(result.status).toBe('started');
      expect(imported).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(10);

      expect(imported).toHaveLength(1);
      expect(cookieStatuses).toEqual(['imported']);
    } finally {
      vi.useRealTimers();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

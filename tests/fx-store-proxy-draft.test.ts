import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FxBrowserStore } from '../src/main/fx-store';
import type { BrowserEnvDraft, ProxyListItem } from '../src/shared/store-types';

function makeProxy(id: string, overrides: Partial<ProxyListItem> = {}): ProxyListItem {
  return {
    proxyId: id,
    importOrder: Number(id.replace(/\D/g, '')) || 1,
    proxyType: 'Socks5',
    proxyHost: '127.0.0.1',
    proxyPort: 20000,
    proxyAccount: 'user',
    proxyPassword: 'pass',
    refreshUrl: '',
    proxyGroup: '测试组',
    proxyName: `proxy-${id}`,
    ipQueryChannel: 'IP2Location',
    status: 'pending',
    lastCheckedIp: '',
    lastCheckedAt: null,
    ...overrides,
  };
}

function makeDraft(): BrowserEnvDraft {
  return {
    environmentName: '示例环境',
    browserType: 'ChromeBrowser',
    operatingSystem: 'Windows',
    userAgentMode: 'custom',
    userAgent: 'Mozilla/5.0',
    proxyType: 'Socks5',
    proxyChannel: 'IP2Location',
    proxyServer: '127.0.0.1:20000',
    proxyAccount: 'user',
    proxyPassword: 'pass',
    refreshUrl: '',
    ipChangeMonitor: false,
    proxyMode: 'custom',
    accountCookie: '',
    openUrl: '',
    languageMode: 'ip',
    timezoneMode: 'ip',
    geolocationMode: 'ask',
    resolution: 'default',
    fontListMode: 'real',
    fontProtection: 'noise',
    webrtc: 'disable',
    canvas: 'noise',
    webglImage: 'noise',
    webglInfo: 'ua',
    webgpu: 'match-webgl',
    audioContext: 'noise',
    speechVoices: 'enable',
    hardwareSettings: 'noise',
    hardwareConcurrency: '12',
    deviceMemory: '8',
    doNotTrack: 'default',
    battery: 'noise',
    portScanProtection: 'enable',
    pageTlsProtocol: 'default',
    startupArgs: '',
    cookieIsolation: 'default',
    multiOpen: 'browser-default',
    webNotification: 'ask',
    clipboardProtection: 'browser-default',
  };
}

describe('FxBrowserStore proxy and draft persistence', () => {
  it('persists proxy list entries and returns them sorted', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-proxy-store-'));
    try {
      const store = new FxBrowserStore(dir);
      store.saveProxies([makeProxy('proxy_002'), makeProxy('proxy_001')]);
      const list = store.listProxies();
      expect(list.map((item) => item.proxyId)).toEqual(['proxy_001', 'proxy_002']);
      store.upsertProxy(makeProxy('proxy_002', { proxyName: 'updated-name', status: 'normal', lastCheckedIp: '8.8.8.8' }));
      expect(store.listProxies().find((item) => item.proxyId === 'proxy_002')).toMatchObject({
        proxyName: 'updated-name',
        status: 'normal',
        lastCheckedIp: '8.8.8.8',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('saves and loads environment drafts', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-draft-store-'));
    try {
      const store = new FxBrowserStore(dir);
      store.saveEnvironmentDraft(makeDraft());
      expect(store.getEnvironmentDraft()).toMatchObject({
        environmentName: '示例环境',
        browserType: 'ChromeBrowser',
        proxyServer: '127.0.0.1:20000',
        hardwareConcurrency: '12',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

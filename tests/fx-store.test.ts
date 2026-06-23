import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MoreLoginImportReport } from '../src/shared/import-types';
import { FxBrowserStore } from '../src/main/fx-store';

function makeReport(): MoreLoginImportReport {
  return {
    totalProfiles: 2,
    cookieParseSuccess: 1,
    cookieParseFailed: 0,
    proxyParseSuccess: 1,
    proxyEmpty: 1,
    warnings: [],
    profiles: [
      {
        importOrder: 1,
        profileName: 'alpha@example.com',
        platform: 'Google Accounts',
        userDefinedPlatformDomainName: '',
        loginAccount: 'alpha@example.com',
        loginPassword: 'fake-password-1',
        twoFaKey: '',
        passwordProtection: 'Disable',
        sourceProfileId: '1000000000000000001',
        cookieRaw: '[{"name":"sid","value":"fake","domain":".example.com"}]',
        cookieCount: 1,
        proxyInformationRaw: 'socks5://127.0.0.1:20000:user:pass',
        proxy: {
          raw: 'socks5://127.0.0.1:20000:user:pass',
          type: 'socks5',
          host: '127.0.0.1',
          port: 20000,
          username: 'user',
          password: 'pass',
        },
        proxyNumber: '1',
        profileGroup: '测试组',
        profileTag: '标签A',
        profileNote: '第一条',
        userAgent: 'Mozilla/5.0 Chrome/140.0.0.0',
        endToEndEncryption: 'Disable',
        customNumber: '1',
      },
      {
        importOrder: 2,
        profileName: 'beta@example.com',
        platform: 'Google Accounts',
        userDefinedPlatformDomainName: '',
        loginAccount: 'beta@example.com',
        loginPassword: 'fake-password-2',
        twoFaKey: '',
        passwordProtection: 'Enable',
        sourceProfileId: '1000000000000000002',
        cookieRaw: '[]',
        cookieCount: 0,
        proxyInformationRaw: '',
        proxy: null,
        proxyNumber: '',
        profileGroup: '',
        profileTag: '',
        profileNote: '',
        userAgent: 'Mozilla/5.0 Chrome/132.0.0.0',
        endToEndEncryption: 'Disable',
        customNumber: '2',
      },
    ],
  };
}

describe('FxBrowserStore', () => {
  it('persists imported MoreLogin profiles and reads them back in import order', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-store-'));
    try {
      const store = new FxBrowserStore(dir);
      const saved = store.saveMoreLoginImport(makeReport(), 'fake-export-profile.txt');

      expect(saved.totalProfiles).toBe(2);
      expect(saved.sourceFileName).toBe('fake-export-profile.txt');

      const list = store.listEnvironments();
      expect(list).toHaveLength(2);
      expect(list.map((item) => item.importOrder)).toEqual([1, 2]);
      expect(list[0]).toMatchObject({
        environmentId: 'env_000001',
        profileName: 'alpha@example.com',
        sourceProfileId: '1000000000000000001',
        proxyHost: '127.0.0.1',
        proxyPort: 20000,
        cookieCount: 1,
      });
      expect(list[1]).toMatchObject({
        environmentId: 'env_000002',
        profileName: 'beta@example.com',
        proxyHost: '',
        cookieCount: 0,
      });

      store.markEnvironmentStatus('env_000001', 'running');
      expect(store.listEnvironments()[0].status).toBe('running');

      store.markEnvironmentStatus('env_000001', 'stopped');
      expect(store.listEnvironments()[0].status).toBe('stopped');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FxBrowserStore } from '../src/main/fx-store';
import { importMoreLoginFile } from '../src/main/import-morelogin-file';

const sampleExport = `Profile name=alpha@example.com
Platform=Google Accounts
User-defined platform domain name=
Login account=alpha@example.com
Login password=fake-password-1
2FA key=
Password protection=Disable
Profile ID=1000000000000000001
Cookie=[{"name":"sid","value":"fake","domain":".example.com"}]
Proxy information=socks5://127.0.0.1:20000:user:pass
Proxy Number=1
Profile group=测试组
Profile tag=标签A
Profile note=第一条
UA=Mozilla/5.0 Chrome/140.0.0.0
End-to-end encryption=Disable
Custom number=1
`;

describe('importMoreLoginFile', () => {
  it('reads a MoreLogin text file, parses it, saves it, and returns import summary plus environment list', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fx-browser-import-'));
    try {
      const filePath = path.join(dir, 'export_profile.txt');
      writeFileSync(filePath, sampleExport, 'utf8');
      const store = new FxBrowserStore(path.join(dir, 'data'));

      const result = importMoreLoginFile(filePath, store);

      expect(result.summary).toMatchObject({
        sourceFileName: 'export_profile.txt',
        totalProfiles: 1,
        cookieParseSuccess: 1,
        proxyParseSuccess: 1,
      });
      expect(result.environments).toHaveLength(1);
      expect(result.environments[0]).toMatchObject({
        environmentId: 'env_000001',
        importOrder: 1,
        profileName: 'alpha@example.com',
        proxyHost: '127.0.0.1',
        cookieCount: 1,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { describe, expect, it } from 'vitest';
import { parseMoreLoginExportText, parseMoreLoginProxy } from '../src/main/morelogin-importer';

const sampleExport = `Profile name=alpha@example.com
Platform=Google Accounts
User-defined platform domain name=
Login account=alpha@example.com
Login password=fake-password-1
2FA key=
Password protection=Disable
Profile ID=1000000000000000001
Cookie=[{"name":"sid","value":"fake","domain":".example.com","path":"/","secure":true,"http_only":true,"expires":"2030-01-01T00:00:00+00:00"}]
Proxy information=socks5://127.0.0.1:20000:user:pass
Proxy Number=1
Profile group=测试组
Profile tag=标签A
Profile note=第一条
UA=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36
End-to-end encryption=Disable
Custom number=1

Profile name=beta@example.com
Platform=Google Accounts
User-defined platform domain name=
Login account=beta@example.com
Login password=fake-password-2
2FA key=FAKE2FA
Password protection=Enable
Profile ID=1000000000000000002
Cookie=[]
Proxy information=
Proxy Number=
Profile group=
Profile tag=
Profile note=
UA=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36
End-to-end encryption=Disable
Custom number=2
`;

describe('parseMoreLoginProxy', () => {
  it('parses MoreLogin host:port:user:pass proxy format', () => {
    expect(parseMoreLoginProxy('socks5://43.251.17.161:20000:hibo888:hibo888')).toEqual({
      raw: 'socks5://43.251.17.161:20000:hibo888:hibo888',
      type: 'socks5',
      host: '43.251.17.161',
      port: 20000,
      username: 'hibo888',
      password: 'hibo888',
    });
  });

  it('returns null for empty proxy values', () => {
    expect(parseMoreLoginProxy('')).toBeNull();
  });
});

describe('parseMoreLoginExportText', () => {
  it('preserves profile order and parses the expected fields', () => {
    const report = parseMoreLoginExportText(sampleExport);
    expect(report.totalProfiles).toBe(2);
    expect(report.profiles[0].importOrder).toBe(1);
    expect(report.profiles[1].importOrder).toBe(2);
    expect(report.profiles[0].profileName).toBe('alpha@example.com');
    expect(report.profiles[0].sourceProfileId).toBe('1000000000000000001');
    expect(report.profiles[0].cookieCount).toBe(1);
    expect(report.profiles[0].proxy?.host).toBe('127.0.0.1');
    expect(report.profiles[0].profileGroup).toBe('测试组');
    expect(report.profiles[1].proxy).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { EnvironmentListItem } from '../src/shared/store-types';
import { buildBrowserLaunchPlan, findDefaultBrowserExecutable } from '../src/main/browser-launcher';

function normalizePathForAssert(value: string): string {
  return value.replaceAll('\\', '/');
}

function makeEnv(overrides: Partial<EnvironmentListItem> = {}): EnvironmentListItem {
  return {
    environmentId: 'env_000001',
    importOrder: 1,
    profileName: 'alpha@example.com',
    platform: 'Google Accounts',
    platformDomain: 'https://accounts.google.com',
    loginAccount: 'alpha@example.com',
    sourceProfileId: '1000000000000000001',
    proxyRaw: 'socks5://127.0.0.1:20000:user:pass',
    proxyHost: '127.0.0.1',
    proxyPort: 20000,
    proxyNumber: '1',
    profileGroup: '测试组',
    profileTag: '标签A',
    profileNote: '第一条',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    cookieCount: 1,
    cookieRaw: '[{"name":"sid","value":"fake","domain":".example.com"}]',
    cookieImportStatus: 'pending',
    cookieImportedAt: null,
    cookieImportError: '',
    status: 'stopped',
    ...overrides,
  };
}

describe('buildBrowserLaunchPlan', () => {
  it('builds a launch plan with isolated user-data-dir, fingerprint flags, UA, proxy and safe startup flags', () => {
    const plan = buildBrowserLaunchPlan({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      appUserDataDir: 'C:/Users/Test/AppData/Roaming/FX Browser',
      environment: makeEnv(),
    });

    expect(plan.executablePath).toBe('C:/Program Files/Google/Chrome/Application/chrome.exe');
    expect(normalizePathForAssert(plan.profileUserDataDir)).toContain('profiles/env_000001/user_data');
    const normalizedArgs = plan.args.map((arg) => normalizePathForAssert(arg));
    expect(normalizedArgs).toContain('--user-data-dir=C:/Users/Test/AppData/Roaming/FX Browser/profiles/env_000001/user_data');
    expect(plan.args.some((arg) => arg.startsWith('--fingerprint='))).toBe(true);
    expect(plan.args).toContain('--fingerprint-platform=windows');
    expect(plan.args).toContain('--fingerprint-brand=Chrome');
    expect(plan.args).toContain('--fingerprint-brand-version=140');
    expect(plan.args).toContain('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36');
    expect(plan.args).toContain('--proxy-server=socks5://127.0.0.1:20000');
    expect(plan.args).toContain('--no-first-run');
    expect(plan.args).toContain('--disable-default-apps');
    expect(plan.args).toContain('--disable-non-proxied-udp');
  });

  it('opens the FX network check start page instead of a target website by default', () => {
    const plan = buildBrowserLaunchPlan({
      executablePath: 'chrome.exe',
      appUserDataDir: 'C:/FX Browser',
      environment: makeEnv({
        platformDomain: '',
        cookieRaw: '[{"name":"sid","value":"fake","domain":".mail.google.com"},{"name":"sid2","value":"fake","domain":".accounts.google.com"}]',
      }),
    });

    expect(plan.initialUrl.startsWith('data:text/html;charset=utf-8,')).toBe(true);
    const decoded = decodeURIComponent(plan.initialUrl.replace('data:text/html;charset=utf-8,', ''));
    expect(decoded).toContain('FX Browser Multi-source Network Check');
    expect(decoded).toContain('ipapi.co');
    expect(decoded).toContain('ipinfo.io');
    expect(decoded).toContain('ipwho.is');
    expect(decoded).toContain('api.myip.com');
    expect(decoded).toContain('api.ipify.org');
    expect(decoded).toContain('网络连接失败');
    expect(decoded).toContain('alpha@example.com');
    expect(plan.args.at(-1)).toBe(plan.initialUrl);
  });

  it('does not add proxy-server when environment has no proxy host or port', () => {
    const plan = buildBrowserLaunchPlan({
      executablePath: 'chrome.exe',
      appUserDataDir: 'C:/FX Browser',
      environment: makeEnv({ proxyRaw: '', proxyHost: '', proxyPort: null }),
    });

    expect(plan.args.some((arg) => arg.startsWith('--proxy-server='))).toBe(false);
  });
});

describe('findDefaultBrowserExecutable', () => {
  it('prefers configured fingerprint Chromium before system Chrome or Edge', () => {
    const result = findDefaultBrowserExecutable({
      platform: 'win32',
      exists: (candidate) => normalizePathForAssert(candidate) === 'D:/fx/fingerprint-chromium/chrome.exe',
      env: {
        FX_FINGERPRINT_CHROMIUM_PATH: 'D:/fx/fingerprint-chromium/chrome.exe',
        PROGRAMFILES: 'C:/Program Files',
        'PROGRAMFILES(X86)': 'C:/Program Files (x86)',
        LOCALAPPDATA: 'C:/Users/Test/AppData/Local',
      },
    });

    expect(result ? normalizePathForAssert(result) : result).toBe('D:/fx/fingerprint-chromium/chrome.exe');
  });

  it('returns the first existing Chrome or Edge executable path from candidates', () => {
    const result = findDefaultBrowserExecutable({
      platform: 'win32',
      exists: (candidate) => normalizePathForAssert(candidate).includes('Microsoft/Edge'),
      env: {
        PROGRAMFILES: 'C:/Program Files',
        'PROGRAMFILES(X86)': 'C:/Program Files (x86)',
        LOCALAPPDATA: 'C:/Users/Test/AppData/Local',
      },
    });

    expect(result ? normalizePathForAssert(result) : result).toBe('C:/Program Files/Microsoft/Edge/Application/msedge.exe');
  });
});

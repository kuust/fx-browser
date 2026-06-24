import { existsSync } from 'node:fs';
import path from 'node:path';
import type { EnvironmentListItem } from '../shared/store-types.js';

export type BrowserLaunchPlanInput = {
  executablePath: string;
  appUserDataDir: string;
  environment: EnvironmentListItem;
  browserProxyServer?: string | null;
  remoteDebuggingPort?: number | null;
};

export type BrowserLaunchPlan = {
  executablePath: string;
  profileUserDataDir: string;
  initialUrl: string;
  args: string[];
};

export type FindBrowserOptions = {
  platform?: NodeJS.Platform;
  exists?: (candidate: string) => boolean;
  env?: NodeJS.ProcessEnv;
};

function normalizeForChromiumArg(value: string): string {
  return value.replaceAll('\\\\', '/');
}

function proxySchemeFromRaw(raw: string): 'http' | 'https' | 'socks5' {
  const match = raw.match(/^(https?|socks5):\/\//i);
  return (match?.[1]?.toLowerCase() as 'http' | 'https' | 'socks5') ?? 'http';
}

function urlFromDomain(rawDomain: string): string | null {
  const raw = rawDomain.trim().replace(/^\.+/, '');
  if (!raw || raw === 'localhost') return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function preferredCookieDomain(cookieRaw: string): string | null {
  try {
    const cookies = JSON.parse(cookieRaw) as Array<{ domain?: unknown }>;
    const domains = cookies
      .map((cookie) => typeof cookie.domain === 'string' ? cookie.domain.trim().replace(/^\.+/, '') : '')
      .filter(Boolean);
    const preferred = domains.find((domain) => /(^|\.)mail\.google\.com$/i.test(domain))
      ?? domains.find((domain) => /(^|\.)accounts\.google\.com$/i.test(domain))
      ?? domains.find((domain) => !/(^|\.)google\.com$/i.test(domain))
      ?? domains[0];
    return preferred ?? null;
  } catch {
    return null;
  }
}

function initialUrlFromEnvironment(environment: EnvironmentListItem): string {
  return urlFromDomain(environment.platformDomain)
    ?? urlFromDomain(preferredCookieDomain(environment.cookieRaw) ?? '')
    ?? 'about:blank';
}

export function buildBrowserLaunchPlan(input: BrowserLaunchPlanInput): BrowserLaunchPlan {
  const profileUserDataDir = path.join(input.appUserDataDir, 'profiles', input.environment.environmentId, 'user_data');
  const initialUrl = initialUrlFromEnvironment(input.environment);
  const args = [
    `--user-data-dir=${normalizeForChromiumArg(profileUserDataDir)}`,
    '--no-first-run',
    '--disable-default-apps',
    '--disable-notifications',
    '--new-window',
  ];

  if (input.environment.userAgent.trim()) {
    args.push(`--user-agent=${input.environment.userAgent.trim()}`);
  }

  if (input.remoteDebuggingPort) {
    args.push(`--remote-debugging-port=${input.remoteDebuggingPort}`);
  }

  if (input.browserProxyServer) {
    args.push(`--proxy-server=${input.browserProxyServer}`);
  } else if (input.environment.proxyHost && input.environment.proxyPort) {
    const scheme = proxySchemeFromRaw(input.environment.proxyRaw);
    args.push(`--proxy-server=${scheme}://${input.environment.proxyHost}:${input.environment.proxyPort}`);
  }

  args.push(initialUrl);

  return {
    executablePath: input.executablePath,
    profileUserDataDir,
    initialUrl,
    args,
  };
}

export function findDefaultBrowserExecutable(options: FindBrowserOptions = {}): string | null {
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;
  const env = options.env ?? process.env;

  if (platform !== 'win32') return null;

  const programFiles = env.PROGRAMFILES ?? 'C:/Program Files';
  const programFilesX86 = env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)';
  const localAppData = env.LOCALAPPDATA ?? '';

  const candidates = [
    path.join(programFiles, 'Google/Chrome/Application/chrome.exe'),
    path.join(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
    localAppData ? path.join(localAppData, 'Google/Chrome/Application/chrome.exe') : '',
    path.join(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean);

  return candidates.find((candidate) => exists(candidate)) ?? null;
}

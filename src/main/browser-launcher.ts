import { existsSync } from 'node:fs';
import path from 'node:path';
import type { EnvironmentListItem } from '../shared/store-types.js';

export type BrowserLaunchPlanInput = {
  executablePath: string;
  appUserDataDir: string;
  environment: EnvironmentListItem;
  browserProxyServer?: string | null;
};

export type BrowserLaunchPlan = {
  executablePath: string;
  profileUserDataDir: string;
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

export function buildBrowserLaunchPlan(input: BrowserLaunchPlanInput): BrowserLaunchPlan {
  const profileUserDataDir = path.join(input.appUserDataDir, 'profiles', input.environment.environmentId, 'user_data');
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

  if (input.browserProxyServer) {
    args.push(`--proxy-server=${input.browserProxyServer}`);
  } else if (input.environment.proxyHost && input.environment.proxyPort) {
    const scheme = proxySchemeFromRaw(input.environment.proxyRaw);
    args.push(`--proxy-server=${scheme}://${input.environment.proxyHost}:${input.environment.proxyPort}`);
  }

  return {
    executablePath: input.executablePath,
    profileUserDataDir,
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

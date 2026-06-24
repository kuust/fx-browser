import { existsSync } from 'node:fs';
import path from 'node:path';
import type { EnvironmentListItem } from '../shared/store-types.js';

export type BrowserLaunchPlanInput = {
  executablePath: string;
  appUserDataDir: string;
  environment: EnvironmentListItem;
  browserProxyServer?: string | null;
  remoteDebuggingPort?: number | null;
  titleExtensionPath?: string | null;
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

function chromeVersion(ua: string): string | null {
  return ua.match(/Chrome\/(\d+)/)?.[1] ?? null;
}

function fingerprintSeed(environment: EnvironmentListItem): number {
  const base = environment.sourceProfileId || environment.environmentId;
  let hash = 2166136261;
  for (const ch of base) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function startPageHtml(environment: EnvironmentListItem): string {
  const title = environment.profileName || environment.environmentId;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title><style>
  :root{font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;color:#111827;background:#f6f7fb}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 0%,rgba(37,99,235,.14),transparent 34%),#f6f7fb}.card{width:min(760px,calc(100vw - 48px));background:#fff;border:1px solid #e6eaf2;border-radius:24px;box-shadow:0 24px 70px rgba(16,24,40,.12);padding:34px}.top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085}.name{margin:8px 0 0;font-size:30px;letter-spacing:-.04em}.status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#fffaeb;color:#b54708;font-weight:800}.status.ok{background:#ecfdf3;color:#027a48}.status.fail{background:#fef3f2;color:#b42318}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}.item{background:#f8fafc;border:1px solid #edf0f5;border-radius:16px;padding:16px}.label{font-size:12px;color:#667085;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.value{margin-top:8px;font-size:20px;font-weight:800;color:#101828;word-break:break-all}.hint{margin-top:24px;color:#667085;line-height:1.7}.actions{margin-top:24px;display:flex;gap:10px}.btn{border:0;border-radius:11px;background:#2563eb;color:#fff;padding:11px 16px;font-weight:800;text-decoration:none}.ghost{background:#eef2ff;color:#1d4ed8}</style></head><body><main class="card"><div class="top"><div><div class="eyebrow">FX Browser Network Check</div><h1 class="name">${title}</h1></div><div id="status" class="status">检测中...</div></div><section class="grid"><div class="item"><div class="label">IP Address</div><div id="ip" class="value">检测中</div></div><div class="item"><div class="label">Country / Region</div><div id="country" class="value">—</div></div><div class="item"><div class="label">City</div><div id="city" class="value">—</div></div></section><p id="hint" class="hint">正在检测当前环境代理出口。如果网络不通，这里会显示网络连接失败。</p><div class="actions"><a class="btn" href="https://mail.google.com/">打开 Gmail</a><a class="btn ghost" href="https://x.com/">打开 X</a><a class="btn ghost" href="https://ipinfo.io/">备用 IP 检测</a></div></main><script>(async()=>{const s=document.getElementById('status'),ip=document.getElementById('ip'),c=document.getElementById('country'),city=document.getElementById('city'),hint=document.getElementById('hint');try{const r=await fetch('https://ipapi.co/json/',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();s.textContent='网络已连接';s.className='status ok';ip.textContent=d.ip||'未知';c.textContent=[d.country_name,d.region].filter(Boolean).join(' / ')||'未知';city.textContent=d.city||'未知';hint.textContent='代理出口检测成功。你可以继续打开目标网站。'}catch(e){s.textContent='网络连接失败';s.className='status fail';ip.textContent='网络连接失败';hint.textContent='当前环境无法完成 IP 检测，请检查 Clash、代理账号或网络连接。'}})();</script></body></html>`;
}

function initialUrlFromEnvironment(environment: EnvironmentListItem): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(startPageHtml(environment))}`;
}

export function buildBrowserLaunchPlan(input: BrowserLaunchPlanInput): BrowserLaunchPlan {
  const profileUserDataDir = path.join(input.appUserDataDir, 'profiles', input.environment.environmentId, 'user_data');
  const initialUrl = initialUrlFromEnvironment(input.environment);
  const args = [
    `--user-data-dir=${normalizeForChromiumArg(profileUserDataDir)}`,
    '--no-first-run',
    '--disable-default-apps',
    '--disable-notifications',
    '--disable-non-proxied-udp',
    `--fingerprint=${fingerprintSeed(input.environment)}`,
    '--fingerprint-platform=windows',
    '--fingerprint-brand=Chrome',
    '--lang=en-US',
    '--accept-lang=en-US,en',
    '--timezone=America/Los_Angeles',
    '--new-window',
  ];

  const version = chromeVersion(input.environment.userAgent);
  if (version) {
    args.push(`--fingerprint-brand-version=${version}`);
  }

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

  if (input.titleExtensionPath) {
    const extensionPath = normalizeForChromiumArg(input.titleExtensionPath);
    args.push(`--disable-extensions-except=${extensionPath}`);
    args.push(`--load-extension=${extensionPath}`);
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

  const electronProcess = process as NodeJS.Process & { resourcesPath?: string };
  const resourcesPath = electronProcess.resourcesPath ?? '';

  const candidates = [
    env.FX_FINGERPRINT_CHROMIUM_PATH ?? '',
    path.join(resourcesPath, 'fingerprint-chromium/chrome.exe'),
    path.join(resourcesPath, 'fingerprint-chromium/ungoogled-chromium.exe'),
    path.join(process.cwd(), 'runtime/fingerprint-chromium/chrome.exe'),
    path.join(process.cwd(), 'runtime/fingerprint-chromium/ungoogled-chromium.exe'),
    path.join(programFiles, 'FX Browser/fingerprint-chromium/chrome.exe'),
    path.join(programFiles, 'Ungoogled Chromium/Application/chrome.exe'),
    path.join(programFiles, 'Google/Chrome/Application/chrome.exe'),
    path.join(programFilesX86, 'Google/Chrome/Application/chrome.exe'),
    localAppData ? path.join(localAppData, 'Google/Chrome/Application/chrome.exe') : '',
    path.join(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(programFilesX86, 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(Boolean);

  return candidates.find((candidate) => exists(candidate)) ?? null;
}

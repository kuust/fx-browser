import type { EnvironmentListItem } from '../shared/store-types.js';

export type ProxyScheme = 'http' | 'https' | 'socks5';

export type ProxyCredential = {
  scheme: ProxyScheme;
  host: string;
  port: number;
  username: string;
  password: string;
  requiresAuth: boolean;
};

export type ProxyBridgePlan =
  | {
      mode: 'none';
      environmentId: string;
      browserProxyServer: null;
      upstream: null;
    }
  | {
      mode: 'direct';
      environmentId: string;
      browserProxyServer: string;
      upstream: ProxyCredential;
    }
  | {
      mode: 'bridge';
      environmentId: string;
      localHost: '127.0.0.1';
      localPort: number;
      browserProxyServer: string;
      upstream: ProxyCredential;
    };

export type BuildProxyBridgePlanInput = {
  environment: EnvironmentListItem;
  basePort?: number;
};

function isScheme(value: string): value is ProxyScheme {
  return value === 'http' || value === 'https' || value === 'socks5';
}

function parseEnvironmentOrdinal(environmentId: string): number {
  const match = environmentId.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function parseProxyCredentialFromRaw(raw: string): ProxyCredential | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const moreLoginMatch = trimmed.match(/^(https?|socks5):\/\/([^:@/]+):(\d+):([^:]+):(.+)$/i);
  if (moreLoginMatch) {
    const scheme = moreLoginMatch[1].toLowerCase();
    if (!isScheme(scheme)) return null;
    return {
      scheme,
      host: moreLoginMatch[2],
      port: Number(moreLoginMatch[3]),
      username: decodeURIComponent(moreLoginMatch[4]),
      password: decodeURIComponent(moreLoginMatch[5]),
      requiresAuth: true,
    };
  }

  try {
    const url = new URL(trimmed);
    const scheme = url.protocol.replace(':', '').toLowerCase();
    if (!isScheme(scheme) || !url.hostname || !url.port) return null;
    return {
      scheme,
      host: url.hostname,
      port: Number(url.port),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      requiresAuth: Boolean(url.username || url.password),
    };
  } catch {
    return null;
  }
}

export function buildProxyBridgePlan(input: BuildProxyBridgePlanInput): ProxyBridgePlan {
  const environment = input.environment;
  const parsed = parseProxyCredentialFromRaw(environment.proxyRaw);
  const fallbackScheme = environment.proxyRaw.match(/^(https?|socks5):\/\//i)?.[1]?.toLowerCase();
  const scheme: ProxyScheme = isScheme(fallbackScheme ?? '') ? fallbackScheme as ProxyScheme : 'http';

  const upstream: ProxyCredential | null = parsed ?? (environment.proxyHost && environment.proxyPort
    ? {
        scheme,
        host: environment.proxyHost,
        port: environment.proxyPort,
        username: '',
        password: '',
        requiresAuth: false,
      }
    : null);

  if (!upstream) {
    return {
      mode: 'none',
      environmentId: environment.environmentId,
      browserProxyServer: null,
      upstream: null,
    };
  }

  if (!upstream.requiresAuth) {
    return {
      mode: 'direct',
      environmentId: environment.environmentId,
      browserProxyServer: `${upstream.scheme}://${upstream.host}:${upstream.port}`,
      upstream,
    };
  }

  const basePort = input.basePort ?? 30000;
  const localPort = basePort + parseEnvironmentOrdinal(environment.environmentId);

  return {
    mode: 'bridge',
    environmentId: environment.environmentId,
    localHost: '127.0.0.1',
    localPort,
    browserProxyServer: `http://127.0.0.1:${localPort}`,
    upstream,
  };
}

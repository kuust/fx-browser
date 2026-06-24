import type { ProxyScheme } from './proxy-bridge.js';

export type ForwardProxyConfig = {
  enabled: boolean;
  scheme: Extract<ProxyScheme, 'http'>;
  host: string;
  port: number;
};

export function defaultForwardProxyConfig(env: NodeJS.ProcessEnv = process.env): ForwardProxyConfig | null {
  const disabled = env.FX_FORWARD_PROXY_ENABLED === '0' || env.FX_FORWARD_PROXY_ENABLED === 'false';
  if (disabled) return null;

  const host = env.FX_FORWARD_PROXY_HOST || '127.0.0.1';
  const port = Number(env.FX_FORWARD_PROXY_PORT || 7890);
  if (!Number.isInteger(port) || port <= 0) return null;

  return {
    enabled: true,
    scheme: 'http',
    host,
    port,
  };
}

import WebSocket from 'ws';
import type { CdpCookie, CookieImportTransport } from './cookie-importer.js';

export type CdpTarget = {
  webSocketDebuggerUrl?: string;
  type?: string;
  url?: string;
};

export type CdpCookieTransportOptions = {
  debuggingPort: number;
  fetchJson?: (url: string) => Promise<unknown>;
  createSocket?: (url: string) => Pick<WebSocket, 'on' | 'send' | 'close'>;
  timeoutMs?: number;
};

export class CdpCookieTransport implements CookieImportTransport {
  private readonly fetchJson: (url: string) => Promise<unknown>;
  private readonly createSocket: (url: string) => Pick<WebSocket, 'on' | 'send' | 'close'>;
  private readonly timeoutMs: number;

  constructor(private readonly options: CdpCookieTransportOptions) {
    this.fetchJson = options.fetchJson ?? (async (url) => (await fetch(url)).json() as Promise<unknown>);
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async setCookies(cookies: CdpCookie[]): Promise<void> {
    const target = await this.findTarget();
    if (!target.webSocketDebuggerUrl) throw new Error('未找到可用的 Chromium CDP 调试目标');
    await this.sendCommand(target.webSocketDebuggerUrl, 'Network.setCookies', { cookies });
  }

  private async findTarget(): Promise<CdpTarget> {
    const targets = await this.fetchJson(`http://127.0.0.1:${this.options.debuggingPort}/json`);
    if (!Array.isArray(targets)) throw new Error('Chromium CDP /json 返回格式异常');
    const pages = targets as CdpTarget[];
    const page = pages.find((target) => target.type === 'page' && target.webSocketDebuggerUrl) ?? pages.find((target) => target.webSocketDebuggerUrl);
    if (!page) throw new Error('Chromium CDP 没有可用页面目标');
    return page;
  }

  private sendCommand(webSocketUrl: string, method: string, params: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.createSocket(webSocketUrl);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error(`CDP command timeout: ${method}`));
      }, this.timeoutMs);

      socket.on('open', () => {
        socket.send(JSON.stringify({ id: 1, method, params }));
      });

      socket.on('message', (data: WebSocket.RawData) => {
        const message = JSON.parse(String(data)) as { id?: number; error?: { message?: string } };
        if (message.id !== 1) return;
        clearTimeout(timer);
        socket.close();
        if (message.error) {
          reject(new Error(message.error.message ?? `CDP command failed: ${method}`));
          return;
        }
        resolve();
      });

      socket.on('error', (error: Error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
}

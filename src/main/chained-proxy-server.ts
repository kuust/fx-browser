import net from 'node:net';
import { Buffer } from 'node:buffer';
import type { ForwardProxyConfig } from './forward-proxy-config.js';
import type { ProxyCredential } from './proxy-bridge.js';

export type ChainedProxyServerOptions = {
  listenHost: '127.0.0.1';
  listenPort: number;
  forwardProxy: ForwardProxyConfig;
  upstream: ProxyCredential;
};

export type ChainedProxyServerHandle = {
  localProxyUrl: string;
  close(): Promise<void>;
};

function writeAndWait(socket: net.Socket, payload: string, expected: RegExp): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      const data = Buffer.concat(chunks);
      const text = data.toString('latin1');
      if (text.includes('\r\n\r\n')) {
        cleanup();
        if (!expected.test(text)) reject(new Error(`代理握手失败：${text.split('\r\n')[0]}`));
        else resolve(data);
      }
    };
    socket.on('data', onData);
    socket.on('error', onError);
    socket.write(payload);
  });
}

function connectViaHttpProxy(forwardProxy: ForwardProxyConfig, targetHost: string, targetPort: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(forwardProxy.port, forwardProxy.host);
    socket.once('connect', async () => {
      try {
        await writeAndWait(socket, `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`, /^HTTP\/1\.[01] 200/i);
        resolve(socket);
      } catch (error) {
        socket.destroy();
        reject(error);
      }
    });
    socket.once('error', reject);
  });
}

function socks5Connect(socket: net.Socket, upstream: ProxyCredential, targetHost: string, targetPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      socket.off('error', fail);
      reject(error);
    };
    socket.once('error', fail);
    socket.write(Buffer.from([0x05, 0x01, 0x02]));
    socket.once('data', (methodResponse) => {
      if (methodResponse[1] !== 0x02) return fail(new Error('SOCKS5 代理不接受账号密码认证'));
      const user = Buffer.from(upstream.username);
      const pass = Buffer.from(upstream.password);
      socket.write(Buffer.concat([Buffer.from([0x01, user.length]), user, Buffer.from([pass.length]), pass]));
      socket.once('data', (authResponse) => {
        if (authResponse[1] !== 0x00) return fail(new Error('SOCKS5 账号密码认证失败'));
        const host = Buffer.from(targetHost);
        const port = Buffer.alloc(2);
        port.writeUInt16BE(targetPort, 0);
        socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, host.length]), host, port]));
        socket.once('data', (connectResponse) => {
          socket.off('error', fail);
          if (connectResponse[1] !== 0x00) return reject(new Error(`SOCKS5 连接目标失败，代码 ${connectResponse[1]}`));
          resolve();
        });
      });
    });
  });
}

async function openUpstreamTunnel(options: ChainedProxyServerOptions, targetHost: string, targetPort: number): Promise<net.Socket> {
  const socket = await connectViaHttpProxy(options.forwardProxy, options.upstream.host, options.upstream.port);
  if (options.upstream.scheme !== 'socks5') {
    socket.destroy();
    throw new Error(`链式代理暂只支持 SOCKS5 环境代理，当前为 ${options.upstream.scheme}`);
  }
  await socks5Connect(socket, options.upstream, targetHost, targetPort);
  return socket;
}

export async function startChainedProxyServer(options: ChainedProxyServerOptions): Promise<ChainedProxyServerHandle> {
  const server = net.createServer((client) => {
    client.once('data', async (firstChunk) => {
      const header = firstChunk.toString('latin1');
      const firstLine = header.split('\r\n')[0] ?? '';
      const match = firstLine.match(/^CONNECT\s+([^:]+):(\d+)\s+HTTP\/1\.[01]$/i);
      if (!match) {
        client.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
        return;
      }

      try {
        const upstream = await openUpstreamTunnel(options, match[1], Number(match[2]));
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        client.pipe(upstream);
        upstream.pipe(client);
        upstream.once('error', () => client.destroy());
        client.once('error', () => upstream.destroy());
      } catch (error) {
        client.end(`HTTP/1.1 502 Bad Gateway\r\nX-FX-Proxy-Error: ${(error as Error).message}\r\n\r\n`);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.listenPort, options.listenHost, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : options.listenPort;

  return {
    localProxyUrl: `http://${options.listenHost}:${actualPort}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

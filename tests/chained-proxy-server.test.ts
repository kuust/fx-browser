import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { startChainedProxyServer } from '../src/main/chained-proxy-server';

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (typeof address === 'object' && address) resolve(address.port);
      else reject(new Error('missing test server port'));
    });
  });
}

function close(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe('startChainedProxyServer', () => {
  it('routes browser CONNECT through Clash forward proxy before SOCKS5 upstream', async () => {
    const events: string[] = [];
    const forward = net.createServer((socket) => {
      socket.once('data', (chunk) => {
        const request = chunk.toString('latin1');
        events.push(request.split('\r\n')[0] ?? '');
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        socket.once('data', (method) => {
          events.push(`socks-method:${method.toString('hex')}`);
          socket.write(Buffer.from([0x05, 0x02]));
          socket.once('data', (auth) => {
            events.push(`socks-auth:${auth.toString('hex')}`);
            socket.write(Buffer.from([0x01, 0x00]));
            socket.once('data', (connect) => {
              events.push(`socks-connect:${connect.toString('hex')}`);
              socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 80]));
            });
          });
        });
      });
    });
    const forwardPort = await listen(forward);
    const chain = await startChainedProxyServer({
      listenHost: '127.0.0.1',
      listenPort: 0,
      forwardProxy: { enabled: true, scheme: 'http', host: '127.0.0.1', port: forwardPort },
      upstream: { scheme: 'socks5', host: 'upstream.proxy.local', port: 20000, username: 'user', password: 'pass', requiresAuth: true },
    });

    const chainPort = Number(new URL(chain.localProxyUrl).port);
    const client = net.connect(chainPort, '127.0.0.1');
    const response = await new Promise<string>((resolve, reject) => {
      client.once('error', reject);
      client.once('connect', () => client.write('CONNECT mail.google.com:443 HTTP/1.1\r\nHost: mail.google.com:443\r\n\r\n'));
      client.once('data', (data) => resolve(data.toString('latin1')));
    });

    expect(response).toContain('HTTP/1.1 200 Connection Established');
    expect(events[0]).toBe('CONNECT upstream.proxy.local:20000 HTTP/1.1');
    expect(events[1]).toBe('socks-method:050102');
    expect(events[2]).toBe('socks-auth:0104757365720470617373');
    expect(events[3]).toContain('6d61696c2e676f6f676c652e636f6d');

    client.destroy();
    await chain.close();
    await close(forward);
  });
});

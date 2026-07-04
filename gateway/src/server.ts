import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, GatewayMessage } from '@sim/shared';
import type { TagBus } from './bus';
import { probeTia, type TiaConnectionManager } from './tiaConnection';

/**
 * Republishes the bus over WebSocket: hello (with snapshot) on connect, then
 * streams updates. Accepts write messages from clients; rejections are
 * reported back with a writeError instead of dropping silently.
 */
export function startWsServer(bus: TagBus, tia: TiaConnectionManager, port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    const hello: GatewayMessage = {
      type: 'hello',
      adapters: bus.adapters,
      tags: bus.tags,
      snapshot: bus.snapshot(),
    };
    ws.send(JSON.stringify(hello));
    console.log(`[server] client connected (${wss.clients.size} total)`);
    ws.on('close', () => console.log(`[server] client disconnected (${wss.clients.size} total)`));

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        console.warn('[server] ignoring malformed client frame');
        return;
      }
      if (msg?.type === 'write') {
        const { tagId, value } = msg;
        void bus.write(tagId, value).catch((err: Error) => {
          console.warn(`[server] write rejected for '${tagId}': ${err.message}`);
          const errorMsg: GatewayMessage = { type: 'writeError', tagId, reason: err.message };
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(errorMsg));
        });
        return;
      }
      if (msg?.type === 'refreshTags') {
        const { adapterId } = msg;
        // the successful broadcast is driven by bus.onTagsChanged below (shared
        // with the adapter's own auto-refresh); here we only relay failures.
        bus.refreshAdapterTags(adapterId).catch((err: Error) => {
          console.warn(`[server] tag refresh failed for '${adapterId}': ${err.message}`);
          const errorMsg: GatewayMessage = { type: 'tagsRefreshError', adapterId, reason: err.message };
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(errorMsg));
        });
        return;
      }
      if (msg?.type === 'testTia') {
        const { requestId, url } = msg;
        void probeTia(url).then((result) => {
          const out: GatewayMessage = { type: 'tiaTestResult', requestId, ok: result.ok, reason: result.reason };
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(out));
        });
        return;
      }
      if (msg?.type === 'connectTia') {
        const { requestId, url } = msg;
        tia
          .reconnect(url)
          .then((adapter) => {
            console.log(`[server] tia connected to ${url} (${adapter.tags.length} tag(s))`);
            const out: GatewayMessage = {
              type: 'tiaConnected',
              requestId,
              meta: adapter.meta,
              tags: adapter.tags,
            };
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(out));
            broadcast({ type: 'tagsChanged', adapterId: adapter.meta.id, meta: adapter.meta, tags: adapter.tags });
          })
          .catch((err: Error) => {
            console.warn(`[server] connect to '${url}' failed: ${err.message}`);
            const out: GatewayMessage = { type: 'tiaConnectError', requestId, reason: err.message };
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(out));
          });
      }
    });
  });

  function broadcast(msg: GatewayMessage): void {
    if (wss.clients.size === 0) return;
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }

  bus.subscribe((updates) => broadcast({ type: 'tagUpdate', updates }));
  // one broadcast source for every reconciled tag set — the ⟳ button AND an
  // adapter noticing its own program changed both land here.
  bus.onTagsChanged((adapterId, meta, tags) => {
    console.log(`[server] '${adapterId}' tags changed (${tags.length} tag(s)) — broadcasting`);
    broadcast({ type: 'tagsChanged', adapterId, meta, tags });
  });

  return wss;
}

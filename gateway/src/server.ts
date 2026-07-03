import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, GatewayMessage } from '@sim/shared';
import type { TagBus } from './bus';

/**
 * Republishes the bus over WebSocket: hello (with snapshot) on connect, then
 * streams updates. Accepts write messages from clients; rejections are
 * reported back with a writeError instead of dropping silently.
 */
export function startWsServer(bus: TagBus, port: number): WebSocketServer {
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
        bus
          .refreshAdapterTags(adapterId)
          .then((tags) => {
            console.log(`[server] '${adapterId}' tags refreshed (${tags.length} tag(s))`);
            broadcast({ type: 'tagsChanged', adapterId, tags });
          })
          .catch((err: Error) => {
            console.warn(`[server] tag refresh failed for '${adapterId}': ${err.message}`);
            const errorMsg: GatewayMessage = { type: 'tagsRefreshError', adapterId, reason: err.message };
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(errorMsg));
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

  return wss;
}

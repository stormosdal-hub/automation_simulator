import type { ClientMessage, GatewayMessage } from '@sim/shared';
import type { TagStore } from './tagStore';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface GatewayConnection {
  /** Fire-and-forget tag write; the confirmed value comes back via the update stream. */
  write(tagId: string, value: number | boolean): void;
}

export function connectGateway(
  url: string,
  store: TagStore,
  onStatus: (status: WsStatus) => void,
): GatewayConnection {
  let current: WebSocket | null = null;

  const connect = () => {
    onStatus('connecting');
    const ws = new WebSocket(url);
    current = ws;
    ws.onopen = () => onStatus('connected');
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as GatewayMessage;
      if (store.livePaused && msg.type !== 'writeError') return; // replay owns the store
      if (msg.type === 'hello') store.applyHello(msg);
      else if (msg.type === 'tagUpdate') store.apply(msg.updates);
      else if (msg.type === 'writeError')
        console.warn(`[gateway] write rejected for '${msg.tagId}': ${msg.reason}`);
    };
    ws.onclose = () => {
      onStatus('disconnected');
      setTimeout(connect, 1500);
    };
    ws.onerror = () => ws.close();
  };
  connect();

  return {
    write(tagId, value) {
      if (current?.readyState === WebSocket.OPEN) {
        const msg: ClientMessage = { type: 'write', tagId, value };
        current.send(JSON.stringify(msg));
      } else {
        console.warn(`[gateway] write dropped (not connected): ${tagId}`);
      }
    },
  };
}

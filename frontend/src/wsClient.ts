import type { ClientMessage, GatewayMessage, TagMeta } from '@sim/shared';
import type { TagStore } from './tagStore';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface GatewayConnection {
  /** Fire-and-forget tag write; the confirmed value comes back via the update stream. */
  write(tagId: string, value: number | boolean): void;
  /** Ask an adapter to re-discover its tags live; resolves with its new complete tag set. */
  refreshTags(adapterId: string): Promise<TagMeta[]>;
}

const STRUCTURAL_TYPES = new Set(['writeError', 'tagsChanged', 'tagsRefreshError']);

export function connectGateway(
  url: string,
  store: TagStore,
  onStatus: (status: WsStatus) => void,
): GatewayConnection {
  let current: WebSocket | null = null;
  const pendingRefresh = new Map<string, { resolve: (t: TagMeta[]) => void; reject: (e: Error) => void }>();

  const connect = () => {
    onStatus('connecting');
    const ws = new WebSocket(url);
    current = ws;
    ws.onopen = () => onStatus('connected');
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as GatewayMessage;
      // structural/control messages aren't "live values" — let them through even during replay
      if (store.livePaused && !STRUCTURAL_TYPES.has(msg.type)) return;
      if (msg.type === 'hello') store.applyHello(msg);
      else if (msg.type === 'tagUpdate') store.apply(msg.updates);
      else if (msg.type === 'writeError')
        console.warn(`[gateway] write rejected for '${msg.tagId}': ${msg.reason}`);
      else if (msg.type === 'tagsChanged') {
        store.applyTagsChanged(msg.adapterId, msg.tags);
        pendingRefresh.get(msg.adapterId)?.resolve(msg.tags);
        pendingRefresh.delete(msg.adapterId);
      } else if (msg.type === 'tagsRefreshError') {
        console.warn(`[gateway] tag refresh failed for '${msg.adapterId}': ${msg.reason}`);
        pendingRefresh.get(msg.adapterId)?.reject(new Error(msg.reason));
        pendingRefresh.delete(msg.adapterId);
      }
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
    refreshTags(adapterId) {
      return new Promise((resolve, reject) => {
        if (current?.readyState !== WebSocket.OPEN) {
          reject(new Error('not connected'));
          return;
        }
        pendingRefresh.set(adapterId, { resolve, reject });
        const msg: ClientMessage = { type: 'refreshTags', adapterId };
        current.send(JSON.stringify(msg));
      });
    },
  };
}

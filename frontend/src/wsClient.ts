import type { AdapterMeta, ClientMessage, GatewayMessage, TagMeta } from '@sim/shared';
import type { TagStore } from './tagStore';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

export interface GatewayConnection {
  /** Fire-and-forget tag write; the confirmed value comes back via the update stream. */
  write(tagId: string, value: number | boolean): void;
  /** Ask an adapter to re-discover its tags live; resolves with its new complete tag set. */
  refreshTags(adapterId: string): Promise<TagMeta[]>;
  /** Checks a URL is a reachable TIA Web Practice runtime without connecting anything. */
  testTia(url: string): Promise<{ ok: boolean; reason?: string }>;
  /** Hot-swaps the `tia` connection to this URL (works with no prior tia adapter too). */
  connectTia(url: string): Promise<{ meta: AdapterMeta; tags: TagMeta[] }>;
}

const STRUCTURAL_TYPES = new Set([
  'writeError',
  'tagsChanged',
  'tagsRefreshError',
  'tiaTestResult',
  'tiaConnected',
  'tiaConnectError',
]);

export function connectGateway(
  url: string,
  store: TagStore,
  onStatus: (status: WsStatus) => void,
): GatewayConnection {
  let current: WebSocket | null = null;
  let nextRequestId = 1;
  const pendingRefresh = new Map<string, { resolve: (t: TagMeta[]) => void; reject: (e: Error) => void }>();
  const pendingTest = new Map<string, { resolve: (r: { ok: boolean; reason?: string }) => void }>();
  const pendingConnect = new Map<
    string,
    { resolve: (r: { meta: AdapterMeta; tags: TagMeta[] }) => void; reject: (e: Error) => void }
  >();

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
        store.applyTagsChanged(msg.adapterId, msg.tags, msg.meta);
        pendingRefresh.get(msg.adapterId)?.resolve(msg.tags);
        pendingRefresh.delete(msg.adapterId);
      } else if (msg.type === 'tagsRefreshError') {
        console.warn(`[gateway] tag refresh failed for '${msg.adapterId}': ${msg.reason}`);
        pendingRefresh.get(msg.adapterId)?.reject(new Error(msg.reason));
        pendingRefresh.delete(msg.adapterId);
      } else if (msg.type === 'tiaTestResult') {
        pendingTest.get(msg.requestId)?.resolve({ ok: msg.ok, reason: msg.reason });
        pendingTest.delete(msg.requestId);
      } else if (msg.type === 'tiaConnected') {
        // apply directly (not just via the tagsChanged broadcast that follows) so the
        // requester's own re-render right after connectTia() resolves is never stale
        store.applyTagsChanged(msg.meta.id, msg.tags, msg.meta);
        pendingConnect.get(msg.requestId)?.resolve({ meta: msg.meta, tags: msg.tags });
        pendingConnect.delete(msg.requestId);
      } else if (msg.type === 'tiaConnectError') {
        console.warn(`[gateway] TIA connect failed: ${msg.reason}`);
        pendingConnect.get(msg.requestId)?.reject(new Error(msg.reason));
        pendingConnect.delete(msg.requestId);
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
    testTia(url) {
      return new Promise((resolve, reject) => {
        if (current?.readyState !== WebSocket.OPEN) {
          reject(new Error('not connected'));
          return;
        }
        const requestId = String(nextRequestId++);
        pendingTest.set(requestId, { resolve });
        const msg: ClientMessage = { type: 'testTia', requestId, url };
        current.send(JSON.stringify(msg));
      });
    },
    connectTia(url) {
      return new Promise((resolve, reject) => {
        if (current?.readyState !== WebSocket.OPEN) {
          reject(new Error('not connected'));
          return;
        }
        const requestId = String(nextRequestId++);
        pendingConnect.set(requestId, { resolve, reject });
        const msg: ClientMessage = { type: 'connectTia', requestId, url };
        current.send(JSON.stringify(msg));
      });
    },
  };
}

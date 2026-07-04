export interface AdapterMeta {
  id: string;
  label: string;
  type: 'simulator' | 'modbus' | 'opcua' | 'mqtt' | 's7' | 'tiaweb' | 'custom';
  /** Supports re-discovering its tag set live via a 'refreshTags' request (see TiaWebAdapter). */
  canRefreshTags?: boolean;
  /** Human-readable connection target (e.g. the TIA runtime's URL), where meaningful. */
  url?: string;
}

export interface TagMeta {
  /** Fully qualified, unique across the gateway: `<adapterId>.<name>`. */
  id: string;
  label: string;
  dataType: 'number' | 'boolean';
  unit?: string;
  adapterId: string;
  /** Accepts writes from clients (commands/setpoints). Absent = read-only. */
  writable?: boolean;
}

export interface TagUpdate {
  tagId: string;
  value: number | boolean;
  ts: number;
}

/** Sent once per connection; snapshot lets late joiners render without waiting a tick. */
export interface HelloMessage {
  type: 'hello';
  adapters: AdapterMeta[];
  tags: TagMeta[];
  snapshot: TagUpdate[];
}

export interface TagUpdateMessage {
  type: 'tagUpdate';
  updates: TagUpdate[];
}

/** Sent to a client whose write was rejected (unknown tag, read-only, adapter error). */
export interface WriteErrorMessage {
  type: 'writeError';
  tagId: string;
  reason: string;
}

/**
 * Broadcast after a successful 'refreshTags' request OR a successful
 * 'connectTia' (reconnecting counts as "this adapter's tags changed" too):
 * the adapter's complete, current meta + tag set — not a diff. Clients
 * upsert both by id and drop this adapter's tag ids no longer present.
 */
export interface TagsChangedMessage {
  type: 'tagsChanged';
  adapterId: string;
  meta: AdapterMeta;
  tags: TagMeta[];
}

/** Sent when a 'refreshTags' request fails (adapter unreachable, or doesn't support it). */
export interface TagsRefreshErrorMessage {
  type: 'tagsRefreshError';
  adapterId: string;
  reason: string;
}

/** Reply to 'testTia', to the requester only — does not change any connection. */
export interface TiaTestResultMessage {
  type: 'tiaTestResult';
  requestId: string;
  ok: boolean;
  reason?: string;
}

/** Reply to a successful 'connectTia', to the requester only (tagsChanged also broadcasts to everyone). */
export interface TiaConnectedMessage {
  type: 'tiaConnected';
  requestId: string;
  meta: AdapterMeta;
  tags: TagMeta[];
}

/** Reply to a failed 'connectTia', to the requester only — the prior connection is left untouched. */
export interface TiaConnectErrorMessage {
  type: 'tiaConnectError';
  requestId: string;
  reason: string;
}

/** Reply to 'removeTia', to the requester (ok:false carries a reason). */
export interface TiaRemovedMessage {
  type: 'tiaRemoved';
  requestId: string;
  adapterId: string;
  ok: boolean;
  reason?: string;
}

/**
 * Broadcast when an adapter is removed from the bus (a TIA connection dropped
 * via the Online menu). Clients drop that adapter and all its tags.
 */
export interface AdapterRemovedMessage {
  type: 'adapterRemoved';
  adapterId: string;
}

export type GatewayMessage =
  | HelloMessage
  | TagUpdateMessage
  | WriteErrorMessage
  | TagsChangedMessage
  | TagsRefreshErrorMessage
  | TiaTestResultMessage
  | TiaConnectedMessage
  | TiaConnectErrorMessage
  | TiaRemovedMessage
  | AdapterRemovedMessage;

/** Client → gateway: write a value to a writable tag. */
export interface WriteMessage {
  type: 'write';
  tagId: string;
  value: number | boolean;
}

/** Client → gateway: re-discover an adapter's tags live (see AdapterMeta.canRefreshTags). */
export interface RefreshTagsMessage {
  type: 'refreshTags';
  adapterId: string;
}

/** Client → gateway: check if a URL is a reachable TIA Web Practice runtime, without connecting. */
export interface TestTiaMessage {
  type: 'testTia';
  requestId: string;
  url: string;
}

/**
 * Client → gateway: connect (or redirect) the TIA connection named `id` to
 * this URL — creates a new connection if `id` is unknown, redirects it if it
 * already exists. Probed server-side before anything is torn down, so a bad
 * address never kills a working connection. Multiple ids = multiple PLCs.
 */
export interface ConnectTiaMessage {
  type: 'connectTia';
  requestId: string;
  id: string;
  url: string;
}

/** Client → gateway: drop the TIA connection named `id` (and all its tags). */
export interface RemoveTiaMessage {
  type: 'removeTia';
  requestId: string;
  id: string;
}

export type ClientMessage =
  | WriteMessage
  | RefreshTagsMessage
  | TestTiaMessage
  | ConnectTiaMessage
  | RemoveTiaMessage;

/** 8081 is commonly taken; keep this in one place so gateway and frontend agree. */
export const DEFAULT_GATEWAY_PORT = 8082;

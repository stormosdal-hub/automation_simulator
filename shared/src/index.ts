export interface AdapterMeta {
  id: string;
  label: string;
  type: 'simulator' | 'modbus' | 'opcua' | 'mqtt' | 'custom';
  /** Supports re-discovering its tag set live via a 'refreshTags' request (see TiaWebAdapter). */
  canRefreshTags?: boolean;
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
 * Broadcast after a successful 'refreshTags' request: the adapter's complete,
 * current tag set (added/edited/removed reconciled — not just a diff).
 * Clients upsert by id and drop this adapter's ids that are no longer present.
 */
export interface TagsChangedMessage {
  type: 'tagsChanged';
  adapterId: string;
  tags: TagMeta[];
}

/** Sent when a 'refreshTags' request fails (adapter unreachable, or doesn't support it). */
export interface TagsRefreshErrorMessage {
  type: 'tagsRefreshError';
  adapterId: string;
  reason: string;
}

export type GatewayMessage =
  | HelloMessage
  | TagUpdateMessage
  | WriteErrorMessage
  | TagsChangedMessage
  | TagsRefreshErrorMessage;

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

export type ClientMessage = WriteMessage | RefreshTagsMessage;

/** 8081 is commonly taken; keep this in one place so gateway and frontend agree. */
export const DEFAULT_GATEWAY_PORT = 8082;

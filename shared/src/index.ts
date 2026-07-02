export interface AdapterMeta {
  id: string;
  label: string;
  type: 'simulator' | 'modbus' | 'opcua' | 'mqtt' | 'custom';
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

export type GatewayMessage = HelloMessage | TagUpdateMessage | WriteErrorMessage;

/** Client → gateway: write a value to a writable tag. */
export interface WriteMessage {
  type: 'write';
  tagId: string;
  value: number | boolean;
}

export type ClientMessage = WriteMessage;

/** 8081 is commonly taken; keep this in one place so gateway and frontend agree. */
export const DEFAULT_GATEWAY_PORT = 8082;

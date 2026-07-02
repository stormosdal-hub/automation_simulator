import NodeS7 from 'nodes7';
import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface S7TagConfig {
  /** Tag id becomes `<adapterId>.<name>`. */
  name: string;
  label?: string;
  /** nodes7 address syntax, e.g. "DB1,REAL0", "DB1,INT10", "DB1,X8.0". */
  address: string;
  dataType: 'number' | 'boolean';
  unit?: string;
  writable?: boolean;
}

export interface S7AdapterConfig {
  id: string;
  label?: string;
  host: string;
  /** Real S7 PLCs listen on 102; the local snap7 sim uses 9102. */
  port?: number;
  rack?: number;
  slot?: number;
  pollMs?: number;
  tags: S7TagConfig[];
}

const RECONNECT_MS = 2000;
const MAX_POLL_FAILURES = 3;

/**
 * Siemens S7 adapter (S7comm over ISO-on-TCP) via the pure-JS nodes7 client.
 * Polled like Modbus — nodes7 batches item reads internally and converts
 * S7 types (REAL/INT/X bits) to JS values. Reconnection creates a fresh
 * NodeS7 instance each attempt; nodes7's internal state is not reliably
 * reusable after a connection loss.
 */
export class S7Adapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private conn: NodeS7 | null = null;
  private publish: PublishFn | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private online = false;
  private polling = false;
  private pollFailures = 0;
  private stopped = false;

  private readonly host: string;
  private readonly port: number;
  private readonly rack: number;
  private readonly slot: number;
  private readonly pollMs: number;
  private readonly tagConfigs: S7TagConfig[];

  constructor(config: S7AdapterConfig) {
    this.host = config.host;
    this.port = config.port ?? 102;
    this.rack = config.rack ?? 0;
    this.slot = config.slot ?? 1;
    this.pollMs = config.pollMs ?? 100;
    this.tagConfigs = config.tags;
    this.meta = {
      id: config.id,
      label: config.label ?? `S7 ${this.host}:${this.port}`,
      type: 'custom',
    };
    this.tags = [
      {
        id: `${config.id}.online`,
        label: 'Connection online',
        dataType: 'boolean',
        adapterId: config.id,
      },
      ...config.tags.map(
        (t): TagMeta => ({
          id: `${config.id}.${t.name}`,
          label: t.label ?? t.name,
          dataType: t.dataType,
          unit: t.unit,
          adapterId: config.id,
          writable: t.writable === true,
        }),
      ),
    ];
  }

  start(publish: PublishFn): void {
    this.publish = publish;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.teardown();
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    if (!this.online || !this.conn) throw new Error(`adapter '${this.meta.id}' is offline`);
    const cfg = this.tagConfigs.find((t) => `${this.meta.id}.${t.name}` === tagId);
    if (!cfg) throw new Error(`unknown s7 tag '${tagId}'`);
    if (cfg.dataType === 'boolean' && typeof value !== 'boolean')
      throw new Error(`'${tagId}' expects a boolean`);
    if (cfg.dataType === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new Error(`'${tagId}' expects a number`);

    const conn = this.conn;
    await new Promise<void>((resolve, reject) => {
      const rc = conn.writeItems(cfg.address, value, (anythingBad) => {
        if (anythingBad) reject(new Error(`PLC rejected write to ${cfg.address}`));
        else resolve();
      });
      if (rc !== 0) reject(new Error('another write is in progress — try again'));
    });
  }

  // ---- connection lifecycle ----

  private connect(): void {
    if (this.stopped) return;
    const conn = new NodeS7({ silent: true });
    this.conn = conn;
    conn.initiateConnection(
      { host: this.host, port: this.port, rack: this.rack, slot: this.slot, timeout: 5000 },
      (err) => {
        if (this.stopped || this.conn !== conn) return;
        if (err) {
          this.setOnline(false);
          this.scheduleReconnect();
          return;
        }
        conn.addItems(this.tagConfigs.map((t) => t.address));
        this.pollFailures = 0;
        this.setOnline(true);
        this.timer = setInterval(() => this.poll(), this.pollMs);
        console.log(
          `[s7:${this.meta.id}] connected to ${this.host}:${this.port} rack ${this.rack} slot ${this.slot} (${this.tagConfigs.length} items)`,
        );
      },
    );
  }

  private teardown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const conn = this.conn;
    this.conn = null;
    this.polling = false;
    if (conn) {
      try {
        conn.dropConnection(() => {});
      } catch {
        // stale socket, discard
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.teardown();
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_MS);
  }

  private setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    if (!online) console.log(`[s7:${this.meta.id}] offline — reconnecting every ${RECONNECT_MS} ms`);
    this.publish?.([{ tagId: `${this.meta.id}.online`, value: online, ts: Date.now() }]);
  }

  // ---- polling ----

  private poll(): void {
    if (this.polling || this.stopped || !this.conn) return;
    this.polling = true;
    this.conn.readAllItems((anythingBad, values) => {
      this.polling = false;
      if (this.stopped) return;
      const updates = this.toUpdates(values ?? {});
      if (anythingBad && updates.length === 0) {
        this.pollFailures++;
        if (this.pollFailures >= MAX_POLL_FAILURES && this.online) {
          console.warn(`[s7:${this.meta.id}] ${this.pollFailures} consecutive poll failures`);
          this.setOnline(false);
          this.scheduleReconnect();
        }
        return;
      }
      this.pollFailures = 0;
      updates.push({ tagId: `${this.meta.id}.online`, value: true, ts: Date.now() });
      this.publish?.(updates);
    });
  }

  private toUpdates(values: Record<string, unknown>): TagUpdate[] {
    const now = Date.now();
    const updates: TagUpdate[] = [];
    for (const t of this.tagConfigs) {
      const raw = values[t.address];
      if (t.dataType === 'boolean') {
        if (typeof raw === 'boolean')
          updates.push({ tagId: `${this.meta.id}.${t.name}`, value: raw, ts: now });
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        updates.push({
          tagId: `${this.meta.id}.${t.name}`,
          value: Math.round(raw * 1000) / 1000,
          ts: now,
        });
      }
    }
    return updates;
  }
}

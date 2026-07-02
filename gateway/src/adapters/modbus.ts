import ModbusRTU from 'modbus-serial';
import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface ModbusTagConfig {
  /** Tag id becomes `<adapterId>.<name>`. */
  name: string;
  label?: string;
  kind: 'coil' | 'discrete' | 'holding' | 'input';
  address: number;
  /** engineering = raw * scale + offset (registers only). */
  scale?: number;
  offset?: number;
  /** Interpret the 16-bit register as signed (int16). */
  signed?: boolean;
  unit?: string;
  /** Only honored for coil/holding — other kinds are read-only by protocol. */
  writable?: boolean;
}

export interface ModbusAdapterConfig {
  id: string;
  label?: string;
  host: string;
  port?: number;
  unitId?: number;
  pollMs?: number;
  tags: ModbusTagConfig[];
}

const RECONNECT_MS = 2000;
const MAX_POLL_FAILURES = 3;
/** Modbus read span limit (protocol allows 125 registers / 2000 coils; stay conservative). */
const MAX_SPAN = 120;

/**
 * Modbus TCP adapter: polls configured coils/discretes/holdings/inputs,
 * converts raw registers to engineering units, supports writes to coils and
 * holding registers. Publishes `<id>.online` so the connection state is
 * bindable like any other tag. Requests are serialized through a queue —
 * modbus-serial's client must never see concurrent requests.
 */
export class ModbusAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private client = new ModbusRTU();
  private publish: PublishFn | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private online = false;
  private pollFailures = 0;
  private polling = false;
  private stopped = false;

  private readonly host: string;
  private readonly port: number;
  private readonly unitId: number;
  private readonly pollMs: number;
  private readonly tagConfigs: ModbusTagConfig[];

  constructor(config: ModbusAdapterConfig) {
    this.host = config.host;
    this.port = config.port ?? 502;
    this.unitId = config.unitId ?? 1;
    this.pollMs = config.pollMs ?? 100;
    this.tagConfigs = config.tags;
    this.meta = {
      id: config.id,
      label: config.label ?? `Modbus TCP ${this.host}:${this.port}`,
      type: 'modbus',
    };
    this.tags = [
      {
        id: `${config.id}.online`,
        label: 'Connection online',
        dataType: 'boolean',
        adapterId: config.id,
      },
      ...config.tags.map((t): TagMeta => {
        const isBool = t.kind === 'coil' || t.kind === 'discrete';
        return {
          id: `${config.id}.${t.name}`,
          label: t.label ?? t.name,
          dataType: isBool ? 'boolean' : 'number',
          unit: t.unit,
          adapterId: config.id,
          writable: t.writable === true && (t.kind === 'coil' || t.kind === 'holding'),
        };
      }),
    ];
  }

  start(publish: PublishFn): void {
    this.publish = publish;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.client.close(() => {});
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    if (!this.online) throw new Error(`adapter '${this.meta.id}' is offline`);
    const cfg = this.tagConfigs.find((t) => `${this.meta.id}.${t.name}` === tagId);
    if (!cfg) throw new Error(`unknown modbus tag '${tagId}'`);

    if (cfg.kind === 'coil') {
      if (typeof value !== 'boolean') throw new Error(`'${tagId}' expects a boolean`);
      await this.enqueue(() => this.client.writeCoil(cfg.address, value));
      return;
    }
    if (cfg.kind === 'holding') {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new Error(`'${tagId}' expects a number`);
      const scale = cfg.scale ?? 1;
      const offset = cfg.offset ?? 0;
      let raw = Math.round((value - offset) / scale);
      if (cfg.signed) {
        raw = Math.min(32767, Math.max(-32768, raw));
        if (raw < 0) raw += 65536;
      } else {
        raw = Math.min(65535, Math.max(0, raw));
      }
      await this.enqueue(() => this.client.writeRegister(cfg.address, raw));
      return;
    }
    throw new Error(`'${tagId}' (${cfg.kind}) is read-only by protocol`);
  }

  // ---- connection lifecycle ----

  private async connect(): Promise<void> {
    if (this.stopped) return;
    try {
      this.client = new ModbusRTU();
      await this.client.connectTCP(this.host, { port: this.port });
      this.client.setID(this.unitId);
      this.client.setTimeout(Math.max(500, Math.min(this.pollMs * 3, 2000)));
      this.setOnline(true);
      this.pollFailures = 0;
      this.timer = setInterval(() => void this.poll(), this.pollMs);
      console.log(`[modbus:${this.meta.id}] connected to ${this.host}:${this.port}`);
    } catch {
      this.setOnline(false);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.reconnectTimer = setTimeout(() => void this.connect(), RECONNECT_MS);
  }

  private setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    if (!online) console.log(`[modbus:${this.meta.id}] offline — reconnecting every ${RECONNECT_MS} ms`);
    this.publish?.([{ tagId: `${this.meta.id}.online`, value: online, ts: Date.now() }]);
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const next = this.queue.then(op, op);
    this.queue = next.catch(() => {});
    return next;
  }

  // ---- polling ----

  private async poll(): Promise<void> {
    if (this.polling || this.stopped) return;
    this.polling = true;
    try {
      const updates = await this.enqueue(() => this.readAll());
      this.pollFailures = 0;
      updates.push({ tagId: `${this.meta.id}.online`, value: true, ts: Date.now() });
      this.publish?.(updates);
    } catch (err) {
      this.pollFailures++;
      if (this.pollFailures >= MAX_POLL_FAILURES && this.online) {
        // modbus-serial sometimes rejects with plain objects — dig out a useful message
        const reason =
          err instanceof Error
            ? err.message
            : ((err as { message?: string; name?: string })?.message ??
              (err as { name?: string })?.name ??
              JSON.stringify(err));
        console.warn(
          `[modbus:${this.meta.id}] ${this.pollFailures} consecutive poll failures (${reason})`,
        );
        this.setOnline(false);
        this.client.close(() => {});
        this.scheduleReconnect();
      }
    } finally {
      this.polling = false;
    }
  }

  private async readAll(): Promise<TagUpdate[]> {
    const now = Date.now();
    const updates: TagUpdate[] = [];
    const kinds = ['coil', 'discrete', 'holding', 'input'] as const;

    for (const kind of kinds) {
      const group = this.tagConfigs.filter((t) => t.kind === kind);
      if (group.length === 0) continue;
      const min = Math.min(...group.map((t) => t.address));
      const max = Math.max(...group.map((t) => t.address));
      const span = max - min + 1;

      if (span <= MAX_SPAN) {
        const values = await this.readSpan(kind, min, span);
        for (const t of group) {
          const raw = values[t.address - min];
          if (raw !== undefined) updates.push(this.toUpdate(t, raw, now));
        }
      } else {
        for (const t of group) {
          const values = await this.readSpan(kind, t.address, 1);
          const raw = values[0];
          if (raw !== undefined) updates.push(this.toUpdate(t, raw, now));
        }
      }
    }
    return updates;
  }

  private async readSpan(
    kind: ModbusTagConfig['kind'],
    start: number,
    count: number,
  ): Promise<(number | boolean)[]> {
    switch (kind) {
      case 'coil':
        return (await this.client.readCoils(start, count)).data;
      case 'discrete':
        return (await this.client.readDiscreteInputs(start, count)).data;
      case 'holding':
        return (await this.client.readHoldingRegisters(start, count)).data;
      case 'input':
        return (await this.client.readInputRegisters(start, count)).data;
    }
  }

  private toUpdate(t: ModbusTagConfig, raw: number | boolean, ts: number): TagUpdate {
    const tagId = `${this.meta.id}.${t.name}`;
    if (typeof raw === 'boolean') return { tagId, value: raw, ts };
    let value = raw;
    if (t.signed && value > 32767) value -= 65536;
    value = value * (t.scale ?? 1) + (t.offset ?? 0);
    return { tagId, value: Math.round(value * 1000) / 1000, ts };
  }
}

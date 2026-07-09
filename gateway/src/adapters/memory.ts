import type { TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface MemoryTagConfig {
  name: string;
  label?: string;
  dataType: 'number' | 'boolean';
  initial?: number | boolean;
  unit?: string;
}

export interface MemoryAdapterConfig {
  id: string;
  label?: string;
  tags: MemoryTagConfig[];
}

const HEARTBEAT_MS = 2000; // republish so widgets bound to quiet tags don't dim as stale

/**
 * Virtual tags with no device behind them: every tag is writable and a write
 * just publishes the new value. This is "soft wiring" — bind one machine's
 * sensor OUTPUT and another machine's actuator INPUT to the same memory tag
 * (e.g. photo-eye → `virtual.b1` → pusher) and they couple directly, no PLC
 * or `links` entry needed.
 */
export class MemoryAdapter implements Adapter {
  readonly meta;
  readonly tags: TagMeta[];
  private values = new Map<string, number | boolean>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private publish: PublishFn = () => {};

  constructor(private config: MemoryAdapterConfig) {
    this.meta = { id: config.id, label: config.label ?? 'Virtual tags', type: 'memory' as const };
    this.tags = config.tags.map((t) => ({
      id: `${config.id}.${t.name}`,
      label: t.label ?? t.name,
      dataType: t.dataType,
      unit: t.unit,
      adapterId: config.id,
      writable: true,
    }));
    for (const t of config.tags) {
      this.values.set(`${config.id}.${t.name}`, t.initial ?? (t.dataType === 'boolean' ? false : 0));
    }
  }

  private snapshot(): TagUpdate[] {
    const ts = Date.now();
    return [...this.values].map(([tagId, value]) => ({ tagId, value, ts }));
  }

  start(publish: PublishFn): void {
    this.publish = publish;
    publish(this.snapshot());
    this.timer = setInterval(() => this.publish(this.snapshot()), HEARTBEAT_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    const meta = this.tags.find((t) => t.id === tagId);
    if (!meta) throw new Error(`unknown tag '${tagId}'`);
    if (meta.dataType === 'boolean' ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`'${tagId}' expects a ${meta.dataType}`);
    }
    this.values.set(tagId, value);
    this.publish([{ tagId, value, ts: Date.now() }]);
  }
}

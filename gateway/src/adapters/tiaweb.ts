import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface TiaWebTagConfig {
  /**
   * TIA tag NAME (e.g. "Motor") or absolute address (e.g. "Q0.0", "%MW10").
   * Must match a key in the runtime's /api/state `mem` map — tags are keyed
   * by name there; addresses also work because /api/force resolves both.
   * Tag id becomes `<adapterId>.<name>`.
   */
  name: string;
  label?: string;
  dataType: 'number' | 'boolean';
  unit?: string;
  /** Writes are sent to POST /api/force (PLC inputs / memory forcing). */
  writable?: boolean;
}

export interface TiaWebAdapterConfig {
  id: string;
  label?: string;
  /** Base URL of the TIA Web Practice runtime (plc_server.py), e.g. http://127.0.0.1:8000. */
  url: string;
  pollMs?: number;
  /**
   * Optional explicit tag list. When omitted (the default — no need to hand-edit
   * config.json), `TiaWebAdapter.create()` discovers every declared project tag
   * from `GET /api/tags` once at startup and publishes all of them, writable
   * (the runtime's `/api/force` already forces any tag unconditionally, so this
   * isn't a security boundary — just adapter bookkeeping). Tags added to the
   * ladder program *after* the gateway started need a gateway restart to show
   * up, same as every other adapter's config-driven, boot-time tag list. Supply
   * `tags` explicitly to curate a subset instead.
   */
  tags?: TiaWebTagConfig[];
}

const MAX_POLL_FAILURES = 3;

/** Shape of the fields we consume from GET /api/state. */
interface TiaState {
  running?: boolean;
  mem?: Record<string, number | boolean>;
}

/** Shape of the fields we consume from GET /api/tags. */
interface DiscoveredTag {
  name: string;
  dataType?: string;
  comment?: string | null;
}

async function discoverTags(url: string, timeoutMs: number): Promise<TiaWebTagConfig[]> {
  const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { tags?: DiscoveredTag[] };
  return (body.tags ?? [])
    .filter((t) => t.name)
    .map((t) => ({
      name: t.name,
      label: t.comment || t.name,
      dataType: t.dataType === 'Bool' ? ('boolean' as const) : ('number' as const),
      writable: true,
    }));
}

/**
 * TIA Web Practice PLC adapter: polls the Python runtime's HTTP API
 * (`GET /api/state`, the same endpoint the TIA app's own online monitor uses)
 * and forces values back with `POST /api/force`. Works identically against
 * `plc_server.py --mock` on a dev machine and the real runtime on a
 * Raspberry Pi driving GPIO.
 *
 * Publishes `<id>.online` (gateway ⇄ runtime reachability) and
 * `<id>.running` (PLC RUN/STOP — false while offline) as bindable tags.
 * HTTP polling is stateless, so unlike the socket adapters there is no
 * reconnect dance: the poll loop simply keeps trying and flips `.online`
 * after MAX_POLL_FAILURES consecutive failures.
 */
export class TiaWebAdapter implements Adapter {
  readonly meta: AdapterMeta;

  private publish: PublishFn | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private online = false;
  private pollFailures = 0;
  private polling = false;
  private stopped = false;
  private readonly warnedMissing = new Set<string>();

  private readonly url: string;
  private readonly pollMs: number;
  private readonly timeoutMs: number;
  /** Mutable: refreshTags() replaces this wholesale (add/edit/remove reconciled by the caller). */
  private tagConfigs: TiaWebTagConfig[];
  /** True when config.tags was given explicitly — refreshTags() is then a no-op (nothing to discover). */
  private readonly explicitTags: boolean;

  /** Discovers tags from /api/tags when config.tags is omitted, then constructs. */
  static async create(config: TiaWebAdapterConfig): Promise<TiaWebAdapter> {
    const url = config.url.replace(/\/+$/, '');
    const timeoutMs = Math.max(500, Math.min((config.pollMs ?? 100) * 3, 2000));
    const explicitTags = !!config.tags && config.tags.length > 0;
    let tags: TiaWebTagConfig[] = config.tags ?? [];
    if (!explicitTags) {
      try {
        tags = await discoverTags(url, timeoutMs);
        console.log(`[tiaweb:${config.id}] discovered ${tags.length} tag(s) from ${url}/api/tags`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[tiaweb:${config.id}] tag discovery failed (${reason}) — starting with no tags; ` +
            'refresh once the runtime is reachable, or declare "tags" in config.json',
        );
        tags = [];
      }
    }
    return new TiaWebAdapter(config, tags, explicitTags);
  }

  private constructor(config: TiaWebAdapterConfig, tags: TiaWebTagConfig[], explicitTags: boolean) {
    this.url = config.url.replace(/\/+$/, '');
    this.pollMs = config.pollMs ?? 100;
    this.timeoutMs = Math.max(500, Math.min(this.pollMs * 3, 2000));
    this.tagConfigs = tags;
    this.explicitTags = explicitTags;
    this.meta = {
      id: config.id,
      label: config.label ?? `TIA Web PLC (${this.url})`,
      type: 'custom',
      canRefreshTags: !explicitTags,
      url: this.url,
    };
  }

  /** Computed from tagConfigs so a refreshTags() call is immediately reflected. */
  get tags(): TagMeta[] {
    const id = this.meta.id;
    return [
      { id: `${id}.online`, label: 'Connection online', dataType: 'boolean', adapterId: id },
      { id: `${id}.running`, label: 'PLC running', dataType: 'boolean', adapterId: id },
      ...this.tagConfigs.map(
        (t): TagMeta => ({
          id: `${id}.${t.name}`,
          label: t.label ?? t.name,
          dataType: t.dataType,
          unit: t.unit,
          adapterId: id,
          writable: t.writable === true,
        }),
      ),
    ];
  }

  /** Re-run discovery and adopt the result; a no-op returning the current tags if config.tags was explicit. */
  async refreshTags(): Promise<TagMeta[]> {
    if (this.explicitTags) return this.tags;
    this.tagConfigs = await discoverTags(this.url, this.timeoutMs);
    this.warnedMissing.clear();
    return this.tags;
  }

  start(publish: PublishFn): void {
    this.publish = publish;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.pollMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    if (!this.online) throw new Error(`adapter '${this.meta.id}' is offline`);
    const cfg = this.tagConfigs.find((t) => `${this.meta.id}.${t.name}` === tagId);
    if (!cfg) throw new Error(`unknown TIA tag '${tagId}'`);
    if (cfg.dataType === 'boolean' && typeof value !== 'boolean')
      throw new Error(`'${tagId}' expects a boolean`);
    if (cfg.dataType === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new Error(`'${tagId}' expects a number`);

    const res = await fetch(`${this.url}/api/force`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: cfg.name, value }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`force '${cfg.name}' failed: HTTP ${res.status}`);
    const body = (await res.json()) as { ok?: boolean };
    if (body.ok === false) throw new Error(`runtime rejected force of '${cfg.name}'`);
  }

  // ---- polling ----

  private async poll(): Promise<void> {
    if (this.polling || this.stopped) return;
    this.polling = true;
    try {
      const res = await fetch(`${this.url}/api/state`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const state = (await res.json()) as TiaState;
      this.pollFailures = 0;
      this.setOnline(true);
      this.publish?.(this.toUpdates(state));
    } catch (err) {
      this.pollFailures++;
      if (this.pollFailures >= MAX_POLL_FAILURES && this.online) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[tiaweb:${this.meta.id}] ${this.pollFailures} consecutive poll failures (${reason})`,
        );
        this.setOnline(false);
      }
    } finally {
      this.polling = false;
    }
  }

  private setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    const ts = Date.now();
    const updates: TagUpdate[] = [{ tagId: `${this.meta.id}.online`, value: online, ts }];
    // while unreachable the RUN state is unknown — report stopped so bindings fail safe
    if (!online) updates.push({ tagId: `${this.meta.id}.running`, value: false, ts });
    else console.log(`[tiaweb:${this.meta.id}] connected to ${this.url}`);
    this.publish?.(updates);
  }

  private toUpdates(state: TiaState): TagUpdate[] {
    const ts = Date.now();
    const mem = state.mem ?? {};
    const updates: TagUpdate[] = [
      { tagId: `${this.meta.id}.online`, value: true, ts },
      { tagId: `${this.meta.id}.running`, value: state.running === true, ts },
    ];
    for (const t of this.tagConfigs) {
      const raw = mem[t.name];
      if (raw === undefined) {
        // tag not in the downloaded program (typo, or no program yet) — say so once
        if (!this.warnedMissing.has(t.name)) {
          this.warnedMissing.add(t.name);
          console.warn(
            `[tiaweb:${this.meta.id}] tag '${t.name}' not present in /api/state mem (not in the downloaded program?)`,
          );
        }
        continue;
      }
      this.warnedMissing.delete(t.name);
      const value =
        t.dataType === 'boolean'
          ? raw === true || raw === 1
          : typeof raw === 'number'
            ? raw
            : raw
              ? 1
              : 0;
      updates.push({ tagId: `${this.meta.id}.${t.name}`, value, ts });
    }
    return updates;
  }
}

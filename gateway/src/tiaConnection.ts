import { TiaWebAdapter, type TiaWebAdapterConfig } from './adapters/tiaweb';
import type { TagBus } from './bus';

const PROBE_TIMEOUT_MS = 2000;

export interface TiaProbeResult {
  ok: boolean;
  reason?: string;
}

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Checks a URL is a reachable TIA Web Practice runtime without connecting anything. */
export async function probeTia(url: string): Promise<TiaProbeResult> {
  const base = normalize(url);
  try {
    const res = await fetch(`${base}/api/info`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; scan?: unknown; hasProgram?: unknown };
    if (body.ok !== true || typeof body.scan !== 'number' || typeof body.hasProgram !== 'boolean') {
      return { ok: false, reason: 'unexpected response — not a TIA Web Practice runtime?' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Owns the gateway's live-swappable TIA connections — one or many, each with a
 * distinct `id` (so several PLCs can front one scene). `connect(id, url)`
 * hot-swaps or creates the connection named `id` with no gateway restart;
 * `remove(id)` drops it. Every connect probes the target first — a bad address
 * never tears down a working connection — and always re-discovers tags fresh
 * from the target (an explicit config.json `tags` list only applies to the
 * adapter as declared at startup, not to a UI-driven connect). Works with no
 * `tiaweb` entry in config.json at all (first connect via the Online menu).
 */
export class TiaConnectionManager {
  private configs = new Map<string, TiaWebAdapterConfig>();

  constructor(private bus: TagBus) {}

  /** Called at startup for each `tiaweb` adapter declared in config.json. */
  adopt(config: TiaWebAdapterConfig): void {
    this.configs.set(config.id, config);
  }

  /** Ids of the currently-known TIA connections. */
  list(): string[] {
    return [...this.configs.keys()];
  }

  /** Connect (or redirect) the connection named `id` to `url`. */
  async connect(id: string, url: string): Promise<TiaWebAdapter> {
    const probe = await probeTia(url);
    if (!probe.ok) throw new Error(probe.reason ?? 'unreachable');

    const prev = this.configs.get(id);
    const nextConfig: TiaWebAdapterConfig = {
      id,
      label: prev?.label,
      pollMs: prev?.pollMs,
      url: normalize(url),
      // always rediscover fresh against the (possibly different) target
    };
    const adapter = await TiaWebAdapter.create(nextConfig);
    this.bus.unregisterAdapter(id); // no-op if this id isn't registered yet
    this.bus.register(adapter);
    this.configs.set(id, nextConfig);
    return adapter;
  }

  /** Drop the connection named `id`. Returns false if there was no such connection. */
  remove(id: string): boolean {
    if (!this.configs.has(id)) return false;
    this.bus.unregisterAdapter(id);
    this.configs.delete(id);
    return true;
  }
}

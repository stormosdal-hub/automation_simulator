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
 * Owns the gateway's live-swappable `tia` connection: hot-swaps the
 * TiaWebAdapter to a new URL with no gateway restart, and works even when no
 * `tiaweb` adapter was declared in config.json at all (first-time connect via
 * the Online menu). Always probes the target first — a bad address never
 * tears down a working connection — and always re-discovers tags fresh from
 * the new target (an explicit config.json `tags` list only applies to the
 * adapter config.json declared at startup, not to a UI-driven reconnect).
 */
export class TiaConnectionManager {
  private config: TiaWebAdapterConfig | null = null;

  constructor(private bus: TagBus) {}

  /** Called once at startup if config.json declares a `tiaweb` adapter. */
  adopt(config: TiaWebAdapterConfig): void {
    this.config = config;
  }

  get currentUrl(): string | null {
    return this.config?.url ?? null;
  }

  async reconnect(url: string): Promise<TiaWebAdapter> {
    const probe = await probeTia(url);
    if (!probe.ok) throw new Error(probe.reason ?? 'unreachable');

    const nextConfig: TiaWebAdapterConfig = {
      id: this.config?.id ?? 'tia',
      label: this.config?.label,
      pollMs: this.config?.pollMs,
      url: normalize(url),
      // always rediscover fresh against the (possibly different) target
    };
    const adapter = await TiaWebAdapter.create(nextConfig);
    if (this.config) this.bus.unregisterAdapter(this.config.id);
    this.bus.register(adapter);
    this.config = nextConfig;
    return adapter;
  }
}

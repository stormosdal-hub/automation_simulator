import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';

export type PublishFn = (updates: TagUpdate[]) => void;

/** Extra hooks the bus hands an adapter at start(), beyond value publishing. */
export interface AdapterContext {
  /**
   * Ask the bus to re-run this adapter's refreshTags(), reconcile the result,
   * and broadcast it — the push counterpart of a client-initiated refresh.
   * Used by adapters that can notice their own tag set has changed (e.g.
   * tiaweb spotting a new program revision while polling).
   */
  requestTagRefresh(): Promise<void>;
}

/**
 * A data source plugged into the TagBus: simulator now; Modbus, OPC UA, MQTT
 * bridges later. Tag ids must be fully qualified as `<meta.id>.<name>`.
 */
export interface Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];
  /**
   * Begin producing data; call `publish` with every batch of updates. `ctx`
   * carries extra bus hooks (optional — most adapters only use `publish`).
   */
  start(publish: PublishFn, ctx?: AdapterContext): void;
  stop(): void;
  /**
   * Phase 4 (control panels): write a value to the underlying device.
   * Adapters for read-only sources may omit this.
   */
  write?(tagId: string, value: number | boolean): Promise<void>;
  /**
   * Re-discover this adapter's tag set live (e.g. tiaweb re-reading
   * /api/tags) and return the complete, current TagMeta[]. Adapters with a
   * fixed, config-declared tag set omit this; set
   * `meta.canRefreshTags` to advertise support.
   */
  refreshTags?(): Promise<TagMeta[]>;
}

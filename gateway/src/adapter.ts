import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';

export type PublishFn = (updates: TagUpdate[]) => void;

/**
 * A data source plugged into the TagBus: simulator now; Modbus, OPC UA, MQTT
 * bridges later. Tag ids must be fully qualified as `<meta.id>.<name>`.
 */
export interface Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];
  /** Begin producing data; call `publish` with every batch of updates. */
  start(publish: PublishFn): void;
  stop(): void;
  /**
   * Phase 4 (control panels): write a value to the underlying device.
   * Adapters for read-only sources may omit this.
   */
  write?(tagId: string, value: number | boolean): Promise<void>;
}

import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from './adapter';

export type BusListener = (updates: TagUpdate[]) => void;

/**
 * Normalized pub/sub core: adapters publish in, subscribers (the WS server,
 * later MQTT republishing) fan out. Keeps the latest value per tag so new
 * clients get a full snapshot immediately.
 */
export class TagBus {
  private registered: Adapter[] = [];
  private tagIndex = new Map<string, TagMeta>();
  private latest = new Map<string, TagUpdate>();
  private listeners = new Set<BusListener>();

  register(adapter: Adapter): void {
    for (const tag of adapter.tags) {
      if (this.tagIndex.has(tag.id)) {
        throw new Error(`duplicate tag id '${tag.id}' (adapter '${adapter.meta.id}')`);
      }
      if (tag.adapterId !== adapter.meta.id) {
        throw new Error(
          `tag '${tag.id}' declares adapterId '${tag.adapterId}' but belongs to '${adapter.meta.id}'`,
        );
      }
      this.tagIndex.set(tag.id, tag);
    }
    this.registered.push(adapter);

    const publish: PublishFn = (updates) => {
      const known = updates.filter((u) => {
        if (!this.tagIndex.has(u.tagId)) {
          console.warn(`[bus] dropping update for undeclared tag '${u.tagId}'`);
          return false;
        }
        return true;
      });
      if (known.length === 0) return;
      for (const u of known) this.latest.set(u.tagId, u);
      for (const listener of this.listeners) listener(known);
    };
    adapter.start(publish);
    console.log(`[bus] adapter '${adapter.meta.id}' registered (${adapter.tags.length} tags)`);
  }

  /** Route a client write to the adapter that owns the tag. Throws on rejection. */
  async write(tagId: string, value: number | boolean): Promise<void> {
    const meta = this.tagIndex.get(tagId);
    if (!meta) throw new Error(`unknown tag '${tagId}'`);
    if (!meta.writable) throw new Error(`tag '${tagId}' is read-only`);
    const adapter = this.registered.find((a) => a.meta.id === meta.adapterId);
    if (!adapter?.write) throw new Error(`adapter '${meta.adapterId}' does not support writes`);
    await adapter.write(tagId, value);
  }

  /**
   * Re-run one adapter's tag discovery and reconcile the result into the bus:
   * added tags become visible, edited ones (same id, changed meta) update in
   * place, and ids no longer reported are dropped — a write against a
   * since-removed tag then correctly fails as "unknown tag", same as if it
   * had never existed. Unlike register(), this can run any time the bus is live.
   */
  async refreshAdapterTags(adapterId: string): Promise<TagMeta[]> {
    const adapter = this.registered.find((a) => a.meta.id === adapterId);
    if (!adapter) throw new Error(`unknown adapter '${adapterId}'`);
    if (!adapter.refreshTags) throw new Error(`adapter '${adapterId}' does not support tag refresh`);
    const tags = await adapter.refreshTags();
    for (const tag of tags) {
      if (tag.adapterId !== adapterId) {
        throw new Error(`tag '${tag.id}' declares adapterId '${tag.adapterId}' but belongs to '${adapterId}'`);
      }
    }
    const keepIds = new Set(tags.map((t) => t.id));
    for (const [id, meta] of this.tagIndex) {
      if (meta.adapterId === adapterId && !keepIds.has(id)) {
        this.tagIndex.delete(id);
        this.latest.delete(id);
      }
    }
    for (const t of tags) this.tagIndex.set(t.id, t);
    return tags;
  }

  /** Returns an unsubscribe function. */
  subscribe(listener: BusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get adapters(): AdapterMeta[] {
    return this.registered.map((a) => a.meta);
  }

  get tags(): TagMeta[] {
    return [...this.tagIndex.values()];
  }

  snapshot(): TagUpdate[] {
    return [...this.latest.values()];
  }

  stop(): void {
    for (const a of this.registered) a.stop();
    this.listeners.clear();
  }
}

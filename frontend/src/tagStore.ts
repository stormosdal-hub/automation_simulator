import type { AdapterMeta, HelloMessage, TagMeta, TagUpdate } from '@sim/shared';

export type TagValue = number | boolean;

export interface TagRow {
  meta: TagMeta;
  value: TagValue | null;
  /** Local receive time (not gateway ts) so staleness is immune to clock skew. */
  receivedAt: number | null;
  count: number;
}

/** Latest-value cache fed by the gateway; render loop and table read from here. */
export class TagStore {
  adapters: AdapterMeta[] = [];
  /** While true (replay in progress), live gateway messages are ignored. */
  livePaused = false;
  /** Single observer hook used by the recorder. */
  onApply: ((updates: TagUpdate[]) => void) | null = null;
  private order: string[] = [];
  private metaById = new Map<string, TagMeta>();
  private state = new Map<string, { value: TagValue; receivedAt: number; count: number }>();

  applyHello(msg: HelloMessage): void {
    this.adapters = msg.adapters;
    this.order = msg.tags.map((t) => t.id);
    this.metaById = new Map(msg.tags.map((t) => [t.id, t]));
    this.apply(msg.snapshot);
  }

  /**
   * Reconcile one adapter's tag set after a live refresh: `tags` is that
   * adapter's complete, current list (not a diff) — added ids appear, edited
   * ids (same id, changed meta) update in place, and ids no longer present
   * are dropped (their last value just stops updating elsewhere until then).
   */
  applyTagsChanged(adapterId: string, tags: TagMeta[]): void {
    const otherIds = this.order.filter((id) => this.metaById.get(id)?.adapterId !== adapterId);
    const keepIds = new Set(tags.map((t) => t.id));
    for (const [id, meta] of this.metaById) {
      if (meta.adapterId === adapterId && !keepIds.has(id)) this.metaById.delete(id);
    }
    for (const t of tags) this.metaById.set(t.id, t);
    this.order = [...otherIds, ...tags.map((t) => t.id)];
  }

  apply(updates: TagUpdate[]): void {
    const now = Date.now();
    for (const u of updates) {
      const s = this.state.get(u.tagId);
      if (s) {
        s.value = u.value;
        s.receivedAt = now;
        s.count++;
      } else {
        this.state.set(u.tagId, { value: u.value, receivedAt: now, count: 1 });
      }
    }
    this.onApply?.(updates);
  }

  /** Milliseconds since the tag last received a value; null if never. */
  ageMs(id: string): number | null {
    const s = this.state.get(id);
    return s ? Date.now() - s.receivedAt : null;
  }

  raw(id: string): TagValue | undefined {
    return this.state.get(id)?.value;
  }

  metaFor(id: string): TagMeta | undefined {
    return this.metaById.get(id);
  }

  num(id: string): number | null {
    const v = this.state.get(id)?.value;
    return typeof v === 'number' ? v : null;
  }

  bool(id: string): boolean | null {
    const v = this.state.get(id)?.value;
    return typeof v === 'boolean' ? v : null;
  }

  rows(): TagRow[] {
    return this.order
      .map((id) => {
        const meta = this.metaById.get(id);
        if (!meta) return null;
        const s = this.state.get(id);
        return {
          meta,
          value: s?.value ?? null,
          receivedAt: s?.receivedAt ?? null,
          count: s?.count ?? 0,
        };
      })
      .filter((r): r is TagRow => r !== null);
  }
}

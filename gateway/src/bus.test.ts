import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Adapter, PublishFn } from './adapter';
import { TagBus } from './bus';

function tag(id: string, adapterId: string, extra: Partial<TagMeta> = {}): TagMeta {
  return { id, label: id, dataType: 'number', adapterId, ...extra };
}

/** Minimal in-memory adapter for exercising the bus. */
function fakeAdapter(opts: {
  id: string;
  tags: TagMeta[];
  writable?: boolean;
  refreshTo?: TagMeta[];
}): Adapter & { publish: PublishFn | null; writes: Array<[string, number | boolean]> } {
  const meta: AdapterMeta = { id: opts.id, type: 'simulator', label: opts.id };
  const writes: Array<[string, number | boolean]> = [];
  const a: Adapter & { publish: PublishFn | null; writes: typeof writes } = {
    meta,
    tags: opts.tags,
    publish: null,
    writes,
    start(publish: PublishFn) {
      a.publish = publish;
    },
    stop: vi.fn(),
  };
  if (opts.writable) {
    a.write = async (tagId, value) => {
      writes.push([tagId, value]);
    };
  }
  if (opts.refreshTo) {
    a.refreshTags = async () => opts.refreshTo!;
  }
  return a;
}

describe('TagBus', () => {
  it('indexes an adapter tags and exposes them + a snapshot', () => {
    const bus = new TagBus();
    const a = fakeAdapter({ id: 'sim', tags: [tag('sim.a', 'sim'), tag('sim.b', 'sim')] });
    bus.register(a);
    expect(bus.tags.map((t) => t.id).sort()).toEqual(['sim.a', 'sim.b']);
    a.publish!([{ tagId: 'sim.a', value: 5, ts: 1 }]);
    expect(bus.snapshot()).toEqual([{ tagId: 'sim.a', value: 5, ts: 1 }]);
  });

  it('fans published updates out to subscribers and keeps the latest value', () => {
    const bus = new TagBus();
    const a = fakeAdapter({ id: 'sim', tags: [tag('sim.a', 'sim')] });
    bus.register(a);
    const seen: TagUpdate[][] = [];
    bus.subscribe((u) => seen.push(u));
    a.publish!([{ tagId: 'sim.a', value: 1, ts: 1 }]);
    a.publish!([{ tagId: 'sim.a', value: 2, ts: 2 }]);
    expect(seen).toHaveLength(2);
    expect(bus.snapshot()).toEqual([{ tagId: 'sim.a', value: 2, ts: 2 }]);
  });

  it('drops updates for undeclared tags without notifying subscribers', () => {
    const bus = new TagBus();
    const a = fakeAdapter({ id: 'sim', tags: [tag('sim.a', 'sim')] });
    bus.register(a);
    const seen: TagUpdate[][] = [];
    bus.subscribe((u) => seen.push(u));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    a.publish!([{ tagId: 'sim.ghost', value: 9, ts: 1 }]);
    expect(seen).toHaveLength(0);
    warn.mockRestore();
  });

  it('rejects duplicate tag ids across adapters', () => {
    const bus = new TagBus();
    bus.register(fakeAdapter({ id: 'a', tags: [tag('x.1', 'a')] }));
    expect(() =>
      bus.register(fakeAdapter({ id: 'b', tags: [tag('x.1', 'b')] })),
    ).toThrow(/duplicate tag id/);
  });

  it('rejects a tag whose adapterId does not match its owner', () => {
    const bus = new TagBus();
    expect(() =>
      bus.register(fakeAdapter({ id: 'a', tags: [tag('a.1', 'WRONG')] })),
    ).toThrow(/declares adapterId/);
  });

  describe('write', () => {
    it('routes a write to the owning adapter', async () => {
      const bus = new TagBus();
      const a = fakeAdapter({ id: 'sim', tags: [tag('sim.w', 'sim', { writable: true })], writable: true });
      bus.register(a);
      await bus.write('sim.w', 7);
      expect(a.writes).toEqual([['sim.w', 7]]);
    });

    it('rejects unknown, read-only, and unsupported writes', async () => {
      const bus = new TagBus();
      const ro = fakeAdapter({ id: 'ro', tags: [tag('ro.a', 'ro', { writable: false })] });
      bus.register(ro);
      await expect(bus.write('ro.missing', 1)).rejects.toThrow(/unknown tag/);
      await expect(bus.write('ro.a', 1)).rejects.toThrow(/read-only/);

      const nowrite = fakeAdapter({ id: 'nw', tags: [tag('nw.a', 'nw', { writable: true })] });
      bus.register(nowrite);
      await expect(bus.write('nw.a', 1)).rejects.toThrow(/does not support writes/);
    });
  });

  describe('refreshAdapterTags', () => {
    it('reconciles added / removed tags and notifies onTagsChanged', async () => {
      const bus = new TagBus();
      const a = fakeAdapter({
        id: 'tia',
        tags: [tag('tia.old', 'tia'), tag('tia.keep', 'tia')],
        refreshTo: [tag('tia.keep', 'tia'), tag('tia.new', 'tia')],
      });
      bus.register(a);
      a.publish!([{ tagId: 'tia.old', value: 1, ts: 1 }]);

      const changes: string[][] = [];
      bus.onTagsChanged((_id, _meta, tags) => changes.push(tags.map((t) => t.id)));

      const result = await bus.refreshAdapterTags('tia');
      expect(result.map((t) => t.id).sort()).toEqual(['tia.keep', 'tia.new']);
      // removed tag is gone from the index AND its cached value dropped
      expect(bus.tags.map((t) => t.id).sort()).toEqual(['tia.keep', 'tia.new']);
      expect(bus.snapshot().find((u) => u.tagId === 'tia.old')).toBeUndefined();
      expect(changes).toHaveLength(1);
      expect(changes[0]!.sort()).toEqual(['tia.keep', 'tia.new']);
    });

    it('a write against a since-removed tag correctly fails as unknown', async () => {
      const bus = new TagBus();
      const a = fakeAdapter({
        id: 'tia',
        tags: [tag('tia.gone', 'tia', { writable: true })],
        writable: true,
        refreshTo: [tag('tia.other', 'tia', { writable: true })],
      });
      bus.register(a);
      await bus.refreshAdapterTags('tia');
      await expect(bus.write('tia.gone', 1)).rejects.toThrow(/unknown tag/);
    });

    it('throws for adapters that do not support refresh', async () => {
      const bus = new TagBus();
      bus.register(fakeAdapter({ id: 'sim', tags: [tag('sim.a', 'sim')] }));
      await expect(bus.refreshAdapterTags('sim')).rejects.toThrow(/does not support tag refresh/);
    });
  });

  describe('unregisterAdapter', () => {
    it('drops the adapter, its tags and cached values, and stops it', () => {
      const bus = new TagBus();
      const a = fakeAdapter({ id: 'tia', tags: [tag('tia.a', 'tia')] });
      const b = fakeAdapter({ id: 'sim', tags: [tag('sim.a', 'sim')] });
      bus.register(a);
      bus.register(b);
      a.publish!([{ tagId: 'tia.a', value: 3, ts: 1 }]);

      bus.unregisterAdapter('tia');
      expect(a.stop).toHaveBeenCalledOnce();
      expect(bus.tags.map((t) => t.id)).toEqual(['sim.a']);
      expect(bus.snapshot().find((u) => u.tagId === 'tia.a')).toBeUndefined();
      expect(bus.adapters.map((m) => m.id)).toEqual(['sim']);
    });

    it('is a no-op for an unknown adapter', () => {
      const bus = new TagBus();
      expect(() => bus.unregisterAdapter('nope')).not.toThrow();
    });
  });
});

import type { TagMeta } from '@sim/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagBus } from './bus';
import { type LinkConfig, startLinks } from './links';

function tag(id: string, adapterId: string, extra: Partial<TagMeta> = {}): TagMeta {
  return { id, label: id, dataType: 'number', adapterId, ...extra };
}

/**
 * A stand-in for TagBus exposing only what startLinks touches: `tags`,
 * `subscribe`, `write`. `emit()` drives the subscriber; `writes` records what
 * was routed; `failNext` makes the next write reject (offline-target test).
 */
function fakeBus(tags: TagMeta[]) {
  let listener: ((u: { tagId: string; value: number | boolean; ts: number }[]) => void) | null = null;
  const writes: Array<[string, number | boolean]> = [];
  let failIds = new Set<string>();
  const bus = {
    tags,
    subscribe(fn: typeof listener) {
      listener = fn;
      return () => {};
    },
    write: vi.fn(async (tagId: string, value: number | boolean) => {
      if (failIds.has(tagId)) throw new Error('target offline');
      writes.push([tagId, value]);
    }),
  };
  return {
    bus: bus as unknown as TagBus,
    writes,
    emit(tagId: string, value: number | boolean) {
      listener?.([{ tagId, value, ts: Date.now() }]);
    },
    setFailing(ids: string[]) {
      failIds = new Set(ids);
    },
  };
}

describe('startLinks', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  const bothTags = [
    tag('src.motor', 'src', { dataType: 'boolean' }),
    tag('dst.run', 'dst', { dataType: 'boolean', writable: true }),
    tag('src.duty', 'src', { dataType: 'number' }),
    tag('dst.speed', 'dst', { dataType: 'number', writable: true }),
    tag('dst.lamp', 'dst', { dataType: 'boolean', writable: true }),
    tag('dst.ro', 'dst', { dataType: 'number' }), // read-only
  ];

  it('forwards a source change to the target write', async () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, [{ from: 'src.motor', to: 'dst.run' }]);
    f.emit('src.motor', true);
    await Promise.resolve();
    expect(f.writes).toEqual([['dst.run', true]]);
  });

  it('forwards only CHANGES, not republished identical values', async () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, [{ from: 'src.motor', to: 'dst.run' }]);
    f.emit('src.motor', true);
    f.emit('src.motor', true); // republish — must be suppressed
    f.emit('src.motor', false);
    await Promise.resolve();
    expect(f.writes).toEqual([
      ['dst.run', true],
      ['dst.run', false],
    ]);
  });

  it('applies scale + offset to numeric targets before writing', async () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, [{ from: 'src.duty', to: 'dst.speed', scale: 10, offset: 5 }]);
    f.emit('src.duty', 3);
    await Promise.resolve();
    expect(f.writes).toEqual([['dst.speed', 35]]); // 3*10 + 5
  });

  it('coerces number -> boolean for a boolean target', async () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, [{ from: 'src.duty', to: 'dst.lamp' }]);
    f.emit('src.duty', 0);
    f.emit('src.duty', 4);
    await Promise.resolve();
    expect(f.writes).toEqual([
      ['dst.lamp', false],
      ['dst.lamp', true],
    ]);
  });

  it('coerces boolean -> number for a numeric target', async () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, [{ from: 'src.motor', to: 'dst.speed' }]);
    f.emit('src.motor', true);
    f.emit('src.motor', false);
    await Promise.resolve();
    expect(f.writes).toEqual([
      ['dst.speed', 1],
      ['dst.speed', 0],
    ]);
  });

  it('inverts a boolean target when invert is set', async () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, [{ from: 'src.motor', to: 'dst.run', invert: true }]);
    f.emit('src.motor', true);
    await Promise.resolve();
    expect(f.writes).toEqual([['dst.run', false]]);
  });

  it('drops misconfigured links (unknown tags, read-only target, self-link)', async () => {
    const f = fakeBus(bothTags);
    const links: LinkConfig[] = [
      { from: 'src.ghost', to: 'dst.run' }, // unknown from
      { from: 'src.motor', to: 'dst.ghost' }, // unknown to
      { from: 'src.duty', to: 'dst.ro' }, // read-only target
      { from: 'src.motor', to: 'src.motor' }, // self-link
    ];
    startLinks(f.bus, links);
    f.emit('src.motor', true);
    f.emit('src.duty', 9);
    await Promise.resolve();
    expect(f.writes).toEqual([]); // nothing valid survived
    expect(warn).toHaveBeenCalled();
  });

  it('retries after a failed write once the target comes back', async () => {
    const f = fakeBus(bothTags);
    f.setFailing(['dst.run']);
    startLinks(f.bus, [{ from: 'src.motor', to: 'dst.run' }]);

    f.emit('src.motor', true); // write rejects; lastSent forgotten
    await Promise.resolve();
    await Promise.resolve();
    expect(f.writes).toEqual([]); // nothing landed

    f.setFailing([]); // target recovers
    f.emit('src.motor', true); // same value, but the failed one was forgotten -> retried
    await Promise.resolve();
    expect(f.writes).toEqual([['dst.run', true]]);
  });

  it('does nothing with an empty link list', () => {
    const f = fakeBus(bothTags);
    startLinks(f.bus, []);
    f.emit('src.motor', true);
    expect(f.writes).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });
});

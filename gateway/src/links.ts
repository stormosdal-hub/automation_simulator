import type { TagBus } from './bus';

export interface LinkConfig {
  /** Source tag id (`<adapterId>.<name>`). */
  from: string;
  /** Target tag id — must be declared `writable` by its adapter. */
  to: string;
  /** Number targets: value * scale + offset (applied before coercion). */
  scale?: number;
  offset?: number;
  /** Boolean targets: invert the value before writing. */
  invert?: boolean;
}

/**
 * Tag-link bridge: routes one adapter's published values into another
 * adapter's writes, so devices can drive each other without any client
 * connected — e.g. the TIA PLC's `Motor` output runs the conveyor model, and
 * the model's photo-eye feeds the PLC's `Part_Sensor` input back. This is the
 * piece that turns the gateway from a fan-out hub into a closed loop.
 *
 * Semantics:
 * - Only CHANGES are forwarded (adapters republish unchanged values every
 *   poll/heartbeat; forwarding those would hammer the target device).
 * - Values are coerced to the target's dataType (number 0/1 ⇄ boolean), so a
 *   numeric tag can drive a lamp and vice versa.
 * - A failed write logs once, then retries silently on the next source change
 *   (or republish, since the failed value is forgotten) until it succeeds —
 *   an offline target must not flood the log at poll rate.
 * - Misconfigured links (unknown tags, read-only target, self-link) are
 *   dropped at startup with a warning instead of crashing the gateway.
 */
export function startLinks(bus: TagBus, links: LinkConfig[]): void {
  if (links.length === 0) return;

  const tagById = new Map(bus.tags.map((t) => [t.id, t]));
  const valid: LinkConfig[] = [];
  for (const l of links) {
    if (!tagById.has(l.from)) {
      console.warn(`[links] unknown 'from' tag '${l.from}' — link dropped`);
      continue;
    }
    const target = tagById.get(l.to);
    if (!target) {
      console.warn(`[links] unknown 'to' tag '${l.to}' — link dropped`);
      continue;
    }
    if (!target.writable) {
      console.warn(`[links] target '${l.to}' is not writable — link dropped`);
      continue;
    }
    if (l.from === l.to) {
      console.warn(`[links] '${l.from}' links to itself — link dropped`);
      continue;
    }
    valid.push(l);
  }
  if (valid.length === 0) {
    console.warn('[links] no usable links configured');
    return;
  }

  const lastSent = new Map<string, number | boolean>();
  const failing = new Set<string>();

  bus.subscribe((updates) => {
    for (const u of updates) {
      for (const l of valid) {
        if (l.from !== u.tagId) continue;
        const target = tagById.get(l.to)!;

        let v: number | boolean = u.value;
        if (typeof v === 'number') v = v * (l.scale ?? 1) + (l.offset ?? 0);
        // coerce to the target's type so cross-type links just work
        if (target.dataType === 'boolean') {
          let b = typeof v === 'boolean' ? v : v !== 0;
          if (l.invert) b = !b;
          v = b;
        } else {
          v = typeof v === 'number' ? v : v ? 1 : 0;
        }

        const key = `${l.from}→${l.to}`;
        if (lastSent.get(key) === v) continue;   // forward changes only
        lastSent.set(key, v);
        bus
          .write(l.to, v)
          .then(() => failing.delete(key))
          .catch((err: Error) => {
            lastSent.delete(key);                // retry on the next publish
            if (!failing.has(key)) {
              failing.add(key);
              console.warn(`[links] ${key} write failed: ${err.message} (suppressing repeats until a write succeeds)`);
            }
          });
      }
    }
  });
  console.log(`[links] ${valid.length} tag link(s) active`);
}

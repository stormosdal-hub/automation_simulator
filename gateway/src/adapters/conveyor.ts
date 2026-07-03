import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface ConveyorAdapterConfig {
  id: string;
  label?: string;
  /** Belt length in scene units (parts fall off the end). Default 4. */
  beltLength?: number;
  /** Photo-eye position along the belt. Default 3. */
  eyeAt?: number;
  /** Width of the eye's detection zone (dwell time = width / speed). Default 0.35. */
  eyeWidth?: number;
  /** Belt speed at speedCmd=1 (units/s). Default 1.2. */
  maxSpeed?: number;
  /** Belt speed at speedCmd=0 while running — a floor so the belt always moves. Default 0.4. */
  minSpeed?: number;
  /** Auto-drop a new part every N seconds while running (0 = manual feed only). Default 3. */
  autoFeedS?: number;
  /** How many `part<N>Pos` tags to expose for 3D binding. Default 4. */
  partSlots?: number;
}

const TICK_MS = 33; // ~30 Hz, like the demo simulator
const MAX_PARTS = 8;

/**
 * Conveyor MACHINE MODEL: not a protocol bridge but plant behavior living on
 * the bus, meant to be wired to a PLC through tag links — the closed-loop
 * counterpart to the TIA Web PLC adapter:
 *
 *   tia.Motor         → conv.motorCmd    (PLC output runs the belt)
 *   tia.Conveyor_PWM  → conv.speedCmd    (PLC duty 0..1 scales speed)
 *   conv.photoEye     → tia.Part_Sensor  (the world feeds the PLC input back)
 *
 * Behavior: while `motorCmd` is on, parts advance at
 * `minSpeed + speedCmd*(maxSpeed-minSpeed)`; a feeder drops a part at the
 * belt start every `autoFeedS` seconds (and `feed=true` drops one manually);
 * `photoEye` is true while any part is inside the eye zone; parts falling off
 * the end increment `partsDone`. `part1Pos..partNPos` expose the first N part
 * positions (−1 when the slot is empty) so scene nodes can be bound directly.
 */
export class ConveyorAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private timer: ReturnType<typeof setInterval> | null = null;
  private motorCmd = false;
  private speedCmd = 0;
  private parts: number[] = [];
  private partsDone = 0;
  private feedClock = 0;
  private lastTick = Date.now();

  private readonly beltLength: number;
  private readonly eyeAt: number;
  private readonly eyeWidth: number;
  private readonly maxSpeed: number;
  private readonly minSpeed: number;
  private readonly autoFeedS: number;
  private readonly partSlots: number;

  constructor(config: ConveyorAdapterConfig) {
    this.beltLength = config.beltLength ?? 4;
    this.eyeAt = config.eyeAt ?? 3;
    this.eyeWidth = config.eyeWidth ?? 0.35;
    this.maxSpeed = config.maxSpeed ?? 1.2;
    this.minSpeed = config.minSpeed ?? 0.4;
    this.autoFeedS = config.autoFeedS ?? 3;
    this.partSlots = Math.max(1, config.partSlots ?? 4);
    this.meta = {
      id: config.id,
      label: config.label ?? 'Conveyor line (machine model)',
      type: 'custom',
    };
    const id = config.id;
    this.tags = [
      { id: `${id}.motorCmd`, label: 'Motor command', dataType: 'boolean', adapterId: id, writable: true },
      { id: `${id}.speedCmd`, label: 'Speed command', dataType: 'number', unit: 'duty', adapterId: id, writable: true },
      { id: `${id}.feed`, label: 'Feed part (momentary)', dataType: 'boolean', adapterId: id, writable: true },
      { id: `${id}.running`, label: 'Belt running', dataType: 'boolean', adapterId: id },
      { id: `${id}.beltSpeed`, label: 'Belt speed', dataType: 'number', unit: 'u/s', adapterId: id },
      { id: `${id}.photoEye`, label: 'Photo eye', dataType: 'boolean', adapterId: id },
      { id: `${id}.partsOnBelt`, label: 'Parts on belt', dataType: 'number', adapterId: id },
      { id: `${id}.partsDone`, label: 'Parts delivered', dataType: 'number', adapterId: id },
      ...Array.from({ length: this.partSlots }, (_, i): TagMeta => ({
        id: `${id}.part${i + 1}Pos`,
        label: `Part ${i + 1} position`,
        dataType: 'number',
        unit: 'u',
        adapterId: id,
      })),
    ];
  }

  start(publish: PublishFn): void {
    this.lastTick = Date.now();
    this.timer = setInterval(() => publish(this.tick()), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    const t = (name: string) => `${this.meta.id}.${name}`;
    switch (tagId) {
      case t('motorCmd'):
        if (typeof value !== 'boolean') throw new Error('motorCmd expects a boolean');
        this.motorCmd = value;
        return;
      case t('speedCmd'):
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('speedCmd expects a number');
        this.speedCmd = Math.min(1, Math.max(0, value));
        return;
      case t('feed'):
        if (value === true) this.spawnPart();
        return;
      default:
        throw new Error(`tag '${tagId}' is not writable`);
    }
  }

  private spawnPart(): void {
    if (this.parts.length >= MAX_PARTS) return;   // jam guard, not physics
    this.parts.push(0);
  }

  private tick(): TagUpdate[] {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;

    const running = this.motorCmd;
    const speed = running ? this.minSpeed + this.speedCmd * (this.maxSpeed - this.minSpeed) : 0;

    if (running) {
      this.parts = this.parts.map((p) => p + speed * dt);
      const before = this.parts.length;
      this.parts = this.parts.filter((p) => p <= this.beltLength);
      this.partsDone += before - this.parts.length;

      if (this.autoFeedS > 0) {
        this.feedClock += dt;
        if (this.feedClock >= this.autoFeedS) {
          this.feedClock = 0;
          this.spawnPart();
        }
      }
    }

    const half = this.eyeWidth / 2;
    const eye = this.parts.some((p) => p >= this.eyeAt - half && p <= this.eyeAt + half);

    const id = this.meta.id;
    const updates: TagUpdate[] = [
      { tagId: `${id}.motorCmd`, value: this.motorCmd, ts: now },
      { tagId: `${id}.speedCmd`, value: Math.round(this.speedCmd * 1000) / 1000, ts: now },
      { tagId: `${id}.feed`, value: false, ts: now },
      { tagId: `${id}.running`, value: running, ts: now },
      { tagId: `${id}.beltSpeed`, value: Math.round(speed * 1000) / 1000, ts: now },
      { tagId: `${id}.photoEye`, value: eye, ts: now },
      { tagId: `${id}.partsOnBelt`, value: this.parts.length, ts: now },
      { tagId: `${id}.partsDone`, value: this.partsDone, ts: now },
    ];
    for (let i = 0; i < this.partSlots; i++) {
      const pos = this.parts[i];
      updates.push({
        tagId: `${id}.part${i + 1}Pos`,
        value: pos === undefined ? -1 : Math.round(pos * 1000) / 1000,
        ts: now,
      });
    }
    return updates;
  }
}

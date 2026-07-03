import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface PressAdapterConfig {
  id: string;
  label?: string;
  /** Seconds per full stroke (0 → 300 mm → 0). Default 4. */
  strokeS?: number;
  /** Default pressure setpoint (bar). Default 150, clamped to maxPressure. */
  defaultTarget?: number;
  /** Setpoint clamp (bar). Default 400. */
  maxPressure?: number;
}

const TICK_MS = 33;
const RAM_MAX = 300;        // mm
const PRESS_ZONE = 240;     // pressure builds while ram is below this depth… er, beyond it
const IDLE_PRESSURE = 5;    // bar

/**
 * Hydraulic press MACHINE MODEL — the bus-adapter port of
 * `scripts/s7-plc-sim.mjs` (same dynamics, no S7 stack): while `runCmd` is on
 * the ram strokes 0→300→0 mm over `strokeS`, pressure lags toward
 * `targetPressure` while the ram is deep in the stroke (>240 mm) and decays to
 * ~5 bar otherwise, `cycleCount` +1 per completed stroke. On top of the S7
 * sim's tags it adds the sensors a ladder program wants: `atTop` / `atBottom`
 * end-position switches and a `pressing` zone flag. Wire it to a PLC with tag
 * links, e.g.  tia.Press_Run → press.runCmd,  press.atTop → tia.Press_Top.
 */
export class PressAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private timer: ReturnType<typeof setInterval> | null = null;
  private runCmd = false;
  private targetPressure: number;
  private phase = 0;
  private pressure = IDLE_PRESSURE;
  private cycleCount = 0;
  private lastTick = Date.now();

  private readonly strokeS: number;
  private readonly maxPressure: number;

  constructor(config: PressAdapterConfig) {
    this.strokeS = Math.max(0.5, config.strokeS ?? 4);
    this.maxPressure = config.maxPressure ?? 400;
    this.targetPressure = Math.min(this.maxPressure, config.defaultTarget ?? 150);
    this.meta = {
      id: config.id,
      label: config.label ?? 'Hydraulic press (machine model)',
      type: 'custom',
    };
    const id = config.id;
    this.tags = [
      { id: `${id}.runCmd`, label: 'Run command', dataType: 'boolean', adapterId: id, writable: true },
      { id: `${id}.targetPressure`, label: 'Target pressure', dataType: 'number', unit: 'bar', adapterId: id, writable: true },
      { id: `${id}.ramPosition`, label: 'Ram position', dataType: 'number', unit: 'mm', adapterId: id },
      { id: `${id}.pressure`, label: 'Hydraulic pressure', dataType: 'number', unit: 'bar', adapterId: id },
      { id: `${id}.cycleActive`, label: 'Cycle active', dataType: 'boolean', adapterId: id },
      { id: `${id}.cycleCount`, label: 'Cycle count', dataType: 'number', adapterId: id },
      { id: `${id}.pressing`, label: 'Pressing (in work zone)', dataType: 'boolean', adapterId: id },
      { id: `${id}.atTop`, label: 'Ram at top (limit switch)', dataType: 'boolean', adapterId: id },
      { id: `${id}.atBottom`, label: 'Ram at bottom (limit switch)', dataType: 'boolean', adapterId: id },
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
      case t('runCmd'):
        if (typeof value !== 'boolean') throw new Error('runCmd expects a boolean');
        this.runCmd = value;
        return;
      case t('targetPressure'):
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new Error('targetPressure expects a number');
        this.targetPressure = Math.min(this.maxPressure, Math.max(0, value));
        return;
      default:
        throw new Error(`tag '${tagId}' is not writable`);
    }
  }

  private tick(): TagUpdate[] {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;

    if (this.runCmd) {
      this.phase += dt / this.strokeS;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.cycleCount = (this.cycleCount + 1) & 0x7fff;   // int16 wrap, like the S7 sim
      }
    }
    const ram = (RAM_MAX / 2) * (1 - Math.cos(this.phase * 2 * Math.PI));
    const pressing = this.runCmd && ram > PRESS_ZONE;
    // first-order lag, tick-rate independent (0.15 per 100 ms in the S7 sim)
    const alpha = 1 - Math.pow(1 - 0.15, dt / 0.1);
    this.pressure += ((pressing ? this.targetPressure : IDLE_PRESSURE) - this.pressure) * alpha
      + (Math.random() - 0.5) * 0.8 * (dt / 0.1);
    this.pressure = Math.max(0, this.pressure);

    const id = this.meta.id;
    const r = (v: number) => Math.round(v * 10) / 10;
    return [
      { tagId: `${id}.runCmd`, value: this.runCmd, ts: now },
      { tagId: `${id}.targetPressure`, value: r(this.targetPressure), ts: now },
      { tagId: `${id}.ramPosition`, value: r(ram), ts: now },
      { tagId: `${id}.pressure`, value: r(this.pressure), ts: now },
      { tagId: `${id}.cycleActive`, value: this.runCmd, ts: now },
      { tagId: `${id}.cycleCount`, value: this.cycleCount, ts: now },
      { tagId: `${id}.pressing`, value: pressing, ts: now },
      { tagId: `${id}.atTop`, value: ram < 5, ts: now },
      { tagId: `${id}.atBottom`, value: ram > RAM_MAX - 5, ts: now },
    ];
  }
}

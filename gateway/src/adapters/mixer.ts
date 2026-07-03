import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface MixerAdapterConfig {
  id: string;
  label?: string;
  /** Seconds of mixing per batch. Default 8. */
  batchS?: number;
  /** Over-temperature alarm threshold (degC). Default 50. */
  overTempC?: number;
  /** Default agitator speed setpoint (RPM). Default 600, clamped 0..1500. */
  defaultSpeed?: number;
}

const TICK_MS = 33;
const MAX_RPM = 1500;
const AMBIENT_C = 22;
const BATCH_PULSE_S = 0.6;   // batchDone stays true long enough for a polled PLC to see it

/**
 * Mixer skid MACHINE MODEL — the bus-adapter port of
 * `scripts/opcua-server-sim.mjs` (same dynamics, no OPC UA stack): while
 * `agitatorOn`, the tank level sloshes around 42 % at a rate scaled by
 * `agitatorSpeed`, the motor temperature lags toward a speed-dependent target
 * (25 + speed/1500·40 °C; ambient when idle), and a batch completes every
 * `batchS` seconds of mixing. On top of the OPC UA sim's tags it adds what a
 * ladder program wants: `batchDone` (a ~0.6 s pulse per completed batch — CTU
 * food), `batchProgress` (0–100 %), and an `overTemp` alarm bit. Wire it to a
 * PLC with tag links, e.g.  tia.Mixer_Run → mixer.agitatorOn,
 * mixer.batchDone → tia.Batch_Sensor,  mixer.overTemp → tia.Mixer_Fault.
 */
export class MixerAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private timer: ReturnType<typeof setInterval> | null = null;
  private agitatorOn = false;
  private agitatorSpeed: number;
  private tankLevel = 42;
  private motorTemp = AMBIENT_C;
  private batchCount = 0;
  private mixPhase = 0;
  private batchElapsed = 0;
  private batchPulse = 0;
  private lastTick = Date.now();

  private readonly batchS: number;
  private readonly overTempC: number;

  constructor(config: MixerAdapterConfig) {
    this.batchS = Math.max(1, config.batchS ?? 8);
    this.overTempC = config.overTempC ?? 50;
    this.agitatorSpeed = Math.min(MAX_RPM, Math.max(0, config.defaultSpeed ?? 600));
    this.meta = {
      id: config.id,
      label: config.label ?? 'Mixer skid (machine model)',
      type: 'custom',
    };
    const id = config.id;
    this.tags = [
      { id: `${id}.agitatorOn`, label: 'Agitator on', dataType: 'boolean', adapterId: id, writable: true },
      { id: `${id}.agitatorSpeed`, label: 'Agitator speed', dataType: 'number', unit: 'rpm', adapterId: id, writable: true },
      { id: `${id}.tankLevel`, label: 'Tank level', dataType: 'number', unit: '%', adapterId: id },
      { id: `${id}.motorTemp`, label: 'Motor temperature', dataType: 'number', unit: 'degC', adapterId: id },
      { id: `${id}.batchCount`, label: 'Batch count', dataType: 'number', adapterId: id },
      { id: `${id}.batchProgress`, label: 'Batch progress', dataType: 'number', unit: '%', adapterId: id },
      { id: `${id}.batchDone`, label: 'Batch done (pulse)', dataType: 'boolean', adapterId: id },
      { id: `${id}.overTemp`, label: 'Over temperature', dataType: 'boolean', adapterId: id },
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
      case t('agitatorOn'):
        if (typeof value !== 'boolean') throw new Error('agitatorOn expects a boolean');
        this.agitatorOn = value;
        return;
      case t('agitatorSpeed'):
        if (typeof value !== 'number' || !Number.isFinite(value))
          throw new Error('agitatorSpeed expects a number');
        this.agitatorSpeed = Math.min(MAX_RPM, Math.max(0, value));
        return;
      default:
        throw new Error(`tag '${tagId}' is not writable`);
    }
  }

  private tick(): TagUpdate[] {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;

    if (this.agitatorOn) {
      this.mixPhase += dt * (this.agitatorSpeed / 600);
      this.tankLevel = 42 + Math.sin(this.mixPhase * 0.7) * 18;
      this.batchElapsed += dt;
      if (this.batchElapsed >= this.batchS) {
        this.batchElapsed = 0;
        this.batchCount++;
        this.batchPulse = BATCH_PULSE_S;
      }
    }
    if (this.batchPulse > 0) this.batchPulse = Math.max(0, this.batchPulse - dt);

    // first-order lag, tick-rate independent (0.02 per 100 ms in the OPC UA sim)
    const targetTemp = this.agitatorOn ? 25 + (this.agitatorSpeed / MAX_RPM) * 40 : AMBIENT_C;
    const alpha = 1 - Math.pow(1 - 0.02, dt / 0.1);
    this.motorTemp += (targetTemp - this.motorTemp) * alpha;

    const id = this.meta.id;
    const r = (v: number) => Math.round(v * 10) / 10;
    return [
      { tagId: `${id}.agitatorOn`, value: this.agitatorOn, ts: now },
      { tagId: `${id}.agitatorSpeed`, value: r(this.agitatorSpeed), ts: now },
      { tagId: `${id}.tankLevel`, value: r(this.tankLevel), ts: now },
      { tagId: `${id}.motorTemp`, value: r(this.motorTemp), ts: now },
      { tagId: `${id}.batchCount`, value: this.batchCount, ts: now },
      { tagId: `${id}.batchProgress`, value: r(Math.min(100, (this.batchElapsed / this.batchS) * 100)), ts: now },
      { tagId: `${id}.batchDone`, value: this.batchPulse > 0, ts: now },
      { tagId: `${id}.overTemp`, value: this.motorTemp >= this.overTempC, ts: now },
    ];
  }
}

import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

const TICK_MS = 33; // ~30 Hz

/**
 * Demo machine with a control surface: `cmdRun` (switch) starts/stops it,
 * `speed` (0-100 %) scales heating, `reset` (momentary button, write true)
 * cools the machine back to ambient. Command tags are streamed back too, so
 * widgets always show the confirmed device state.
 */
export class SimulatorAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private timer: ReturnType<typeof setInterval> | null = null;
  private cmdRun = true;
  private speed = 60;
  private temperature = 42;
  private lastTick = Date.now();

  constructor(id = 'sim') {
    this.meta = { id, label: 'Demo machine simulator', type: 'simulator' };
    this.tags = [
      { id: `${id}.cmdRun`, label: 'Run command', dataType: 'boolean', adapterId: id, writable: true },
      { id: `${id}.speed`, label: 'Speed setpoint', dataType: 'number', unit: '%', adapterId: id, writable: true },
      { id: `${id}.reset`, label: 'Reset temperature', dataType: 'boolean', adapterId: id, writable: true },
      { id: `${id}.running`, label: 'Running', dataType: 'boolean', adapterId: id },
      { id: `${id}.temperature`, label: 'Temperature', dataType: 'number', unit: 'degC', adapterId: id },
    ];
  }

  private t(name: string): string {
    return `${this.meta.id}.${name}`;
  }

  start(publish: PublishFn): void {
    this.lastTick = Date.now();
    this.timer = setInterval(() => publish(this.sample()), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    switch (tagId) {
      case this.t('cmdRun'):
        if (typeof value !== 'boolean') throw new Error('cmdRun expects a boolean');
        this.cmdRun = value;
        return;
      case this.t('speed'):
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('speed expects a number');
        this.speed = Math.min(100, Math.max(0, value));
        return;
      case this.t('reset'):
        if (value === true) this.temperature = 20;
        return;
      default:
        throw new Error(`tag '${tagId}' is not writable`);
    }
  }

  private sample(): TagUpdate[] {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const running = this.cmdRun;
    const rate = this.speed / 100;
    this.temperature += (running ? 0.1 + 0.8 * rate : -0.5) * dt + (Math.random() - 0.5) * 0.05;
    this.temperature = Math.min(80, Math.max(20, this.temperature));

    return [
      { tagId: this.t('cmdRun'), value: this.cmdRun, ts: now },
      { tagId: this.t('speed'), value: this.speed, ts: now },
      { tagId: this.t('reset'), value: false, ts: now },
      { tagId: this.t('running'), value: running, ts: now },
      { tagId: this.t('temperature'), value: Math.round(this.temperature * 10) / 10, ts: now },
    ];
  }
}

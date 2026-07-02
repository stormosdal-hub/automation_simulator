import type { TagUpdate } from '@sim/shared';
import type { Panel } from './panel';
import type { TagStore } from './tagStore';
import { button, div, select } from './ui';

interface RecordedEvent {
  t: number; // ms since recording start
  tagId: string;
  value: number | boolean;
}

interface Recording {
  version: 1;
  recordedAt: string;
  events: RecordedEvent[];
}

const TICK_MS = 50;

/**
 * Record the live tag stream and replay it back through the same store the
 * bindings/widgets/table read from. While replaying, live gateway data is
 * suppressed (store.livePaused) so the recorded session owns the UI.
 */
export class ReplayPanel {
  private recording: Recording | null = null;
  private recStart = 0;
  private isRecording = false;

  private playing = false;
  private position = 0; // ms into the recording
  private cursor = 0; // next event index
  private speed = 1;
  private lastTick = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private status = div('replay-status dim');
  private controls = div('');

  constructor(
    private panel: Panel,
    private store: TagStore,
  ) {
    panel.body.append(this.status, this.controls);
    this.render();
    setInterval(() => this.updateStatus(), 250);
  }

  private duration(): number {
    const events = this.recording?.events;
    return events && events.length > 0 ? events[events.length - 1]!.t : 0;
  }

  // ---- recording ----

  private startRecording(): void {
    this.stopReplay();
    this.recording = { version: 1, recordedAt: new Date().toISOString(), events: [] };
    this.recStart = Date.now();
    this.isRecording = true;
    this.store.onApply = (updates: TagUpdate[]) => {
      const t = Date.now() - this.recStart;
      for (const u of updates) this.recording?.events.push({ t, tagId: u.tagId, value: u.value });
    };
    this.render();
  }

  private stopRecording(): void {
    this.isRecording = false;
    this.store.onApply = null;
    this.render();
  }

  // ---- replay ----

  private startReplay(): void {
    if (!this.recording || this.recording.events.length === 0 || this.isRecording) return;
    this.store.livePaused = true;
    this.playing = true;
    this.position = 0;
    this.cursor = 0;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tickReplay(), TICK_MS);
    this.render();
  }

  private pauseReplay(resume: boolean): void {
    this.playing = resume;
    this.lastTick = Date.now();
    this.render();
  }

  private stopReplay(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
    this.position = 0;
    this.cursor = 0;
    if (this.store.livePaused) {
      this.store.livePaused = false; // live stream resumes and overwrites replayed values
    }
    this.render();
  }

  private tickReplay(): void {
    if (!this.recording) return;
    if (!this.playing) return;
    const now = Date.now();
    this.position += (now - this.lastTick) * this.speed;
    this.lastTick = now;

    const events = this.recording.events;
    const batch: TagUpdate[] = [];
    while (this.cursor < events.length && events[this.cursor]!.t <= this.position) {
      const e = events[this.cursor]!;
      batch.push({ tagId: e.tagId, value: e.value, ts: Date.now() });
      this.cursor++;
    }
    if (batch.length > 0) this.store.apply(batch);
    if (this.cursor >= events.length) this.stopReplay();
  }

  // ---- file io ----

  private download(): void {
    if (!this.recording) return;
    const blob = new Blob([JSON.stringify(this.recording)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `automation-sim-recording-${this.recording.recordedAt.replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private async loadFile(file: File): Promise<void> {
    try {
      const parsed = JSON.parse(await file.text()) as Recording;
      if (parsed.version !== 1 || !Array.isArray(parsed.events)) throw new Error('not a recording file');
      this.stopReplay();
      this.recording = parsed;
      this.render();
    } catch (err) {
      alert(`load failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- ui ----

  private updateStatus(): void {
    if (this.isRecording) {
      this.status.textContent = `● recording… ${this.recording?.events.length ?? 0} events`;
      this.status.className = 'replay-status rec';
      this.panel.root.dataset.replay = 'recording';
    } else if (this.store.livePaused) {
      this.status.textContent = `▶ REPLAY ${formatMs(this.position)} / ${formatMs(this.duration())}${this.playing ? '' : ' (paused)'}`;
      this.status.className = 'replay-status replaying';
      this.panel.root.dataset.replay = this.playing ? 'playing' : 'paused';
    } else if (this.recording) {
      this.status.textContent = `recording loaded: ${this.recording.events.length} events, ${formatMs(this.duration())}`;
      this.status.className = 'replay-status dim';
      this.panel.root.dataset.replay = 'idle';
    } else {
      this.status.textContent = 'no recording';
      this.status.className = 'replay-status dim';
      this.panel.root.dataset.replay = 'idle';
    }
  }

  private render(): void {
    this.updateStatus();
    this.controls.innerHTML = '';
    const row = div('btn-row');

    if (!this.isRecording) {
      const rec = button('⏺ Record', 'btn btn-small');
      rec.dataset.role = 'record';
      rec.addEventListener('click', () => this.startRecording());
      row.append(rec);
    } else {
      const stop = button('⏹ Stop recording', 'btn btn-small');
      stop.dataset.role = 'stop-record';
      stop.addEventListener('click', () => this.stopRecording());
      row.append(stop);
    }

    if (this.recording && !this.isRecording) {
      if (!this.store.livePaused) {
        const play = button('▶ Replay', 'btn btn-small');
        play.dataset.role = 'replay';
        play.addEventListener('click', () => this.startReplay());
        row.append(play);
      } else {
        const pause = button(this.playing ? '⏸ Pause' : '▶ Resume', 'btn btn-small');
        pause.dataset.role = 'pause-replay';
        pause.addEventListener('click', () => this.pauseReplay(!this.playing));
        const stop = button('⏹ Live', 'btn btn-small');
        stop.dataset.role = 'stop-replay';
        stop.addEventListener('click', () => this.stopReplay());
        row.append(pause, stop);
      }
      const speedSelect = select(['0.5', '1', '2', '4'], String(this.speed));
      speedSelect.title = 'replay speed';
      speedSelect.style.width = '58px';
      speedSelect.addEventListener('change', () => (this.speed = Number(speedSelect.value)));
      row.append(speedSelect);
    }
    this.controls.append(row);

    const io = div('btn-row');
    if (this.recording && !this.isRecording) {
      const dl = button('Download', 'btn btn-small');
      dl.addEventListener('click', () => this.download());
      io.append(dl);
    }
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.style.display = 'none';
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f) void this.loadFile(f);
      file.value = '';
    });
    const load = button('Load', 'btn btn-small');
    load.addEventListener('click', () => file.click());
    io.append(load, file);
    this.controls.append(io);
  }
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

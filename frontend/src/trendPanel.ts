import type { TagStore } from './tagStore';
import { button, div } from './ui';

const SAMPLE_MS = 250;
const MAX_SAMPLES = 800;
const WINDOWS = [
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '2m', ms: 120_000 },
  { label: '5m', ms: 300_000 },
];

const LINE = '#3d8bff';
const LINE_FILL = 'rgba(61, 139, 255, 0.14)';
const GRID = 'rgba(42, 52, 66, 0.9)';
const CROSSHAIR = 'rgba(143, 163, 184, 0.7)';

interface Sample {
  t: number;
  v: number;
}

interface Series {
  id: string;
  isBool: boolean;
  unit?: string;
  samples: Sample[];
  row: HTMLElement;
  canvas: HTMLCanvasElement;
  valueEl: HTMLElement;
  rangeEl: HTMLElement;
  hoverX: number | null;
}

/**
 * Trends panel: pick numeric or boolean tags and watch them over a rolling
 * time window as compact sparklines — a line per numeric tag (own auto-scaled
 * y-axis + current value), a step line per boolean. Own ring buffers, sampled
 * from the tag store on a timer (decoupled from the update rate). Selection +
 * window persist in localStorage. Single series per chart, so no legend; a
 * hover crosshair reads back the value at a point in time.
 */
export class TrendPanel {
  private windowMs = 60_000;
  /** Source of truth for persistence: the tag ids the user chose to chart. */
  private wanted = new Set<string>();
  /** Materialized rows — a subset of `wanted` whose tag meta is known yet. */
  private series = new Map<string, Series>();
  private addSelect: HTMLSelectElement;
  private list: HTMLElement;
  private empty: HTMLElement;
  private winButtons: HTMLButtonElement[] = [];
  private lastOptionSig = '';

  constructor(
    host: HTMLElement,
    private store: TagStore,
  ) {
    const savedWin = Number(localStorage.getItem('trend:windowMs'));
    if (WINDOWS.some((w) => w.ms === savedWin)) this.windowMs = savedWin;

    const controls = div('trend-controls');
    this.addSelect = document.createElement('select');
    this.addSelect.dataset.role = 'trend-add';
    this.addSelect.addEventListener('change', () => {
      const id = this.addSelect.value;
      if (id) this.want(id);
      this.addSelect.value = '';
    });

    const windows = div('trend-windows');
    for (const w of WINDOWS) {
      const b = button(w.label, 'trend-win-btn');
      b.dataset.win = String(w.ms);
      b.addEventListener('click', () => {
        this.windowMs = w.ms;
        localStorage.setItem('trend:windowMs', String(w.ms));
        this.syncWindowButtons();
      });
      this.winButtons.push(b);
      windows.append(b);
    }
    controls.append(this.addSelect, windows);

    this.empty = div('trend-empty dim');
    this.empty.textContent = 'Pick a tag above to start charting.';
    this.list = div('trend-list');

    host.append(controls, this.empty, this.list);

    this.syncWindowButtons();
    const saved = localStorage.getItem('trend:selected');
    if (saved) {
      try {
        // remember them; rows materialize in tick() once each tag's meta arrives
        // (the gateway `hello` may land after this constructor runs)
        for (const id of JSON.parse(saved) as string[]) this.wanted.add(id);
      } catch {
        /* ignore corrupt selection */
      }
    }
    this.updateEmpty();

    setInterval(() => this.tick(), SAMPLE_MS);
    this.tick();
  }

  private want(id: string): void {
    if (this.wanted.has(id)) return;
    this.wanted.add(id);
    this.persist();
    this.materialize();
    this.updateEmpty();
  }

  private persist(): void {
    localStorage.setItem('trend:selected', JSON.stringify([...this.wanted]));
  }

  private updateEmpty(): void {
    this.empty.style.display = this.wanted.size === 0 ? '' : 'none';
  }

  /** Create a row for any wanted tag whose meta is now known but isn't drawn yet. */
  private materialize(): void {
    for (const id of this.wanted) {
      if (this.series.has(id)) continue;
      const meta = this.store.metaFor(id);
      if (meta) this.createRow(id, meta);
    }
  }

  private syncWindowButtons(): void {
    for (const b of this.winButtons) b.classList.toggle('active', Number(b.dataset.win) === this.windowMs);
  }

  private createRow(id: string, meta: { dataType: string; unit?: string }): void {
    const row = div('trend-row');
    row.dataset.tag = id;
    const head = div('trend-row-head');
    const name = div('trend-name');
    name.textContent = id;
    const valueEl = div('trend-value');
    const rangeEl = div('trend-range dim');
    const remove = button('✕', 'trend-remove');
    remove.title = 'Remove from chart';
    remove.addEventListener('click', () => {
      this.removeSeries(id);
      this.persist();
    });
    head.append(name, rangeEl, valueEl, remove);

    const canvas = document.createElement('canvas');
    canvas.className = 'trend-canvas';
    const s: Series = {
      id,
      isBool: meta.dataType === 'boolean',
      unit: meta.unit,
      samples: [],
      row,
      canvas,
      valueEl,
      rangeEl,
      hoverX: null,
    };
    canvas.addEventListener('pointermove', (e) => {
      s.hoverX = e.clientX - canvas.getBoundingClientRect().left;
      this.draw(s);
    });
    canvas.addEventListener('pointerleave', () => {
      s.hoverX = null;
      this.draw(s);
    });

    row.append(head, canvas);
    this.list.append(row);
    this.series.set(id, s);
  }

  private removeSeries(id: string): void {
    this.wanted.delete(id);
    const s = this.series.get(id);
    if (s) {
      s.row.remove();
      this.series.delete(id);
    }
    this.persist();
    this.updateEmpty();
  }

  private refreshOptions(): void {
    // available = numeric/boolean tags not already chosen; rebuild only on change
    const rows = this.store.rows().filter((r) => r.meta.dataType === 'number' || r.meta.dataType === 'boolean');
    const available = rows.map((r) => r.meta.id).filter((id) => !this.wanted.has(id));
    const sig = available.join('|');
    if (sig === this.lastOptionSig) return;
    this.lastOptionSig = sig;
    this.addSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = available.length ? '+ add tag to chart…' : 'no numeric tags yet';
    this.addSelect.append(placeholder);
    for (const id of available) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      this.addSelect.append(o);
    }
    this.addSelect.value = '';
  }

  private tick(): void {
    this.materialize();
    this.refreshOptions();
    const now = Date.now();
    const cutoff = now - this.windowMs - 1000;
    for (const s of this.series.values()) {
      const raw = this.store.raw(s.id);
      if (raw !== undefined) {
        const v = typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
        s.samples.push({ t: now, v });
        while (s.samples.length > MAX_SAMPLES || (s.samples.length > 2 && s.samples[0]!.t < cutoff)) {
          s.samples.shift();
        }
      }
      this.draw(s);
    }
  }

  private draw(s: Series): void {
    const cssW = s.canvas.clientWidth;
    const cssH = s.canvas.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    const dpr = window.devicePixelRatio || 1;
    if (s.canvas.width !== Math.round(cssW * dpr) || s.canvas.height !== Math.round(cssH * dpr)) {
      s.canvas.width = Math.round(cssW * dpr);
      s.canvas.height = Math.round(cssH * dpr);
    }
    const ctx = s.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const now = Date.now();
    const t0 = now - this.windowMs;
    const pad = 3;
    const win = s.samples.filter((p) => p.t >= t0 - this.windowMs); // keep a little extra for the leading segment

    // y-range
    let lo: number;
    let hi: number;
    if (s.isBool) {
      lo = 0;
      hi = 1;
    } else {
      lo = Infinity;
      hi = -Infinity;
      for (const p of win) {
        if (p.v < lo) lo = p.v;
        if (p.v > hi) hi = p.v;
      }
      if (!isFinite(lo)) {
        lo = 0;
        hi = 1;
      }
      if (hi - lo < 1e-9) {
        hi = lo + 1;
        lo -= 1;
      } else {
        const m = (hi - lo) * 0.12;
        lo -= m;
        hi += m;
      }
    }
    const xAt = (t: number): number => ((t - t0) / this.windowMs) * cssW;
    const yAt = (v: number): number => cssH - pad - ((v - lo) / (hi - lo)) * (cssH - 2 * pad);

    // recessive baseline grid
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(yAt(lo)) + 0.5);
    ctx.lineTo(cssW, Math.round(yAt(lo)) + 0.5);
    ctx.stroke();

    if (win.length >= 2) {
      // area fill under the line
      ctx.beginPath();
      ctx.moveTo(xAt(win[0]!.t), yAt(win[0]!.v));
      for (let i = 1; i < win.length; i++) {
        const p = win[i]!;
        if (s.isBool) ctx.lineTo(xAt(p.t), yAt(win[i - 1]!.v)); // step
        ctx.lineTo(xAt(p.t), yAt(p.v));
      }
      const lastX = xAt(win[win.length - 1]!.t);
      ctx.lineTo(lastX, yAt(lo));
      ctx.lineTo(xAt(win[0]!.t), yAt(lo));
      ctx.closePath();
      ctx.fillStyle = LINE_FILL;
      ctx.fill();

      // the line itself
      ctx.beginPath();
      ctx.moveTo(xAt(win[0]!.t), yAt(win[0]!.v));
      for (let i = 1; i < win.length; i++) {
        const p = win[i]!;
        if (s.isBool) ctx.lineTo(xAt(p.t), yAt(win[i - 1]!.v));
        ctx.lineTo(xAt(p.t), yAt(p.v));
      }
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // emphasized latest point
      const last = win[win.length - 1]!;
      ctx.beginPath();
      ctx.arc(Math.min(lastX, cssW - 2), yAt(last.v), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = LINE;
      ctx.fill();
    }

    // hover crosshair -> read the nearest sample back into the value label
    let shown: Sample | null = win.length ? win[win.length - 1]! : null;
    if (s.hoverX !== null && win.length) {
      const hx = s.hoverX;
      let best = win[0]!;
      let bestD = Infinity;
      for (const p of win) {
        const d = Math.abs(xAt(p.t) - hx);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      shown = best;
      const cx = xAt(best.t);
      ctx.strokeStyle = CROSSHAIR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, 0);
      ctx.lineTo(Math.round(cx) + 0.5, cssH);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, yAt(best.v), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = CROSSHAIR;
      ctx.fill();
    }

    // value + range labels
    if (shown) {
      s.valueEl.textContent = s.isBool
        ? shown.v >= 0.5
          ? 'true'
          : 'false'
        : `${fmt(shown.v)}${s.unit ? ' ' + s.unit : ''}`;
    } else {
      s.valueEl.textContent = '—';
    }
    s.rangeEl.textContent = s.isBool || !win.length ? '' : `${fmt(lo)}…${fmt(hi)}`;
  }
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a < 0.01 || a >= 100000)) return v.toExponential(1);
  return Number.isInteger(v) ? String(v) : v.toFixed(a < 10 ? 2 : 1);
}

import type { TagMeta } from '@sim/shared';
import type { Widget } from './bindings/types';
import type { TagStore, TagValue } from './tagStore';
import type { GatewayConnection } from './wsClient';

export interface WidgetInstance {
  el: HTMLElement;
  /** Called on the shared refresh tick with the tag's confirmed value. */
  update(value: TagValue | undefined, meta: TagMeta | undefined): void;
}

interface Deps {
  store: TagStore;
  conn: GatewayConnection;
}

const KNOB_WRITE_THROTTLE_MS = 80;

export function buildWidget(widget: Widget, deps: Deps): WidgetInstance {
  const el = document.createElement('div');
  el.className = `widget widget-${widget.type}`;
  el.dataset.widgetId = widget.id;
  el.dataset.tag = widget.tagId;

  const label = document.createElement('div');
  label.className = 'widget-label';
  label.textContent = widget.label;
  label.title = widget.tagId;
  el.append(label);

  switch (widget.type) {
    case 'led':
      return buildLed(el, widget);
    case 'switch':
      return buildSwitch(el, widget, deps);
    case 'button':
      return buildButton(el, widget, deps);
    case 'knob':
      return buildKnob(el, widget, deps);
    case 'gauge':
      return buildGauge(el, widget);
  }
}

// ---- LED ----

function buildLed(el: HTMLElement, widget: Widget): WidgetInstance {
  const onColor = widget.config?.onColor ?? '#26f259';
  const offColor = widget.config?.offColor ?? '#3a3f46';
  const dot = document.createElement('div');
  dot.className = 'led';
  const state = document.createElement('div');
  state.className = 'widget-value dim';
  el.append(dot, state);
  return {
    el,
    update(value) {
      const on = value === true;
      dot.style.background = on ? onColor : offColor;
      dot.style.boxShadow = on ? `0 0 10px 1px ${onColor}` : 'none';
      state.textContent = value === undefined ? '—' : on ? 'on' : 'off';
    },
  };
}

// ---- switch ----

function buildSwitch(el: HTMLElement, widget: Widget, deps: Deps): WidgetInstance {
  const track = document.createElement('div');
  track.className = 'switch';
  track.setAttribute('role', 'switch');
  const thumb = document.createElement('div');
  thumb.className = 'switch-thumb';
  track.append(thumb);
  const state = document.createElement('div');
  state.className = 'widget-value dim';
  el.append(track, state);
  track.addEventListener('click', () => {
    const current = deps.store.bool(widget.tagId);
    deps.conn.write(widget.tagId, !(current === true));
  });
  return {
    el,
    update(value) {
      track.classList.toggle('on', value === true);
      state.textContent = value === undefined ? '—' : value === true ? 'on' : 'off';
    },
  };
}

// ---- momentary button ----

function buildButton(el: HTMLElement, widget: Widget, deps: Deps): WidgetInstance {
  const btn = document.createElement('button');
  btn.className = 'btn push-btn';
  btn.type = 'button';
  btn.textContent = '●';
  el.append(btn);
  let pressed = false;
  const press = (down: boolean) => {
    if (pressed === down) return;
    pressed = down;
    deps.conn.write(widget.tagId, down);
  };
  btn.addEventListener('pointerdown', () => press(true));
  btn.addEventListener('pointerup', () => press(false));
  btn.addEventListener('pointerleave', () => press(false));
  btn.addEventListener('pointercancel', () => press(false));
  return { el, update() {} };
}

// ---- knob ----

function buildKnob(el: HTMLElement, widget: Widget, deps: Deps): WidgetInstance {
  const min = widget.config?.min ?? 0;
  const max = widget.config?.max ?? 100;
  const span = max - min || 1;

  const svg = svgEl('svg', { viewBox: '0 0 64 64', class: 'knob' });
  const track = svgEl('path', { d: arcPath(32, 32, 24, -135, 135), class: 'dial-track' });
  const fill = svgEl('path', { d: '', class: 'dial-fill' });
  const needle = svgEl('line', { class: 'dial-needle', x1: '32', y1: '32', x2: '32', y2: '10' });
  svg.append(track, fill, needle);
  const valueText = document.createElement('div');
  valueText.className = 'widget-value';
  el.append(svg, valueText);

  let dragging = false;
  let dragValue = 0;
  let lastSent = 0;
  // burst wheel/drag input outruns the write→confirm round trip; prefer the
  // local value briefly so successive steps accumulate instead of resetting
  let localValue = 0;
  let localUntil = 0;
  const localFresh = () => Date.now() < localUntil;
  const setLocal = (v: number) => {
    localValue = v;
    localUntil = Date.now() + 600;
  };

  const show = (v: number, meta?: TagMeta) => {
    const clamped = Math.min(max, Math.max(min, v));
    const angle = -135 + (270 * (clamped - min)) / span;
    fill.setAttribute('d', arcPath(32, 32, 24, -135, angle));
    const [nx, ny] = polar(32, 32, 18, angle);
    needle.setAttribute('x2', String(nx));
    needle.setAttribute('y2', String(ny));
    valueText.textContent = `${clamped.toFixed(0)}${meta?.unit ? ' ' + meta.unit : ''}`;
  };

  const sendThrottled = (v: number, final = false) => {
    const now = Date.now();
    if (final || now - lastSent >= KNOB_WRITE_THROTTLE_MS) {
      lastSent = now;
      deps.conn.write(widget.tagId, Math.min(max, Math.max(min, v)));
    }
  };

  svg.addEventListener('pointerdown', (ev) => {
    dragging = true;
    dragValue = deps.store.num(widget.tagId) ?? min;
    const startY = ev.clientY;
    const startValue = dragValue;
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch {
      // synthetic events may lack a capturable pointer
    }
    const move = (mv: PointerEvent) => {
      dragValue = startValue + ((startY - mv.clientY) / 120) * span;
      dragValue = Math.min(max, Math.max(min, dragValue));
      show(dragValue);
      sendThrottled(dragValue);
    };
    const up = () => {
      dragging = false;
      sendThrottled(dragValue, true);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    ev.preventDefault();
  });

  svg.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const current = dragging
        ? dragValue
        : localFresh()
          ? localValue
          : (deps.store.num(widget.tagId) ?? min);
      const step = span / 40;
      const next = Math.min(max, Math.max(min, current - Math.sign(ev.deltaY) * step));
      dragValue = next;
      setLocal(next);
      show(next);
      sendThrottled(next, true);
    },
    { passive: false },
  );

  return {
    el,
    update(value, meta) {
      if (dragging || localFresh()) return;
      if (typeof value === 'number') show(value, meta);
      else valueText.textContent = '—';
    },
  };
}

// ---- gauge ----

function buildGauge(el: HTMLElement, widget: Widget): WidgetInstance {
  const min = widget.config?.min ?? 0;
  const max = widget.config?.max ?? 100;
  const span = max - min || 1;

  const svg = svgEl('svg', { viewBox: '0 0 110 78', class: 'gauge' });
  const track = svgEl('path', { d: arcPath(55, 52, 38, -135, 135), class: 'dial-track' });
  const fill = svgEl('path', { d: '', class: 'dial-fill' });
  const minLabel = svgEl('text', { x: '18', y: '74', class: 'dial-label' });
  minLabel.textContent = String(min);
  const maxLabel = svgEl('text', { x: '92', y: '74', class: 'dial-label', 'text-anchor': 'end' });
  maxLabel.textContent = String(max);
  svg.append(track, fill, minLabel, maxLabel);
  const valueText = document.createElement('div');
  valueText.className = 'widget-value';
  el.append(svg, valueText);

  return {
    el,
    update(value, meta) {
      if (typeof value !== 'number') {
        valueText.textContent = '—';
        fill.setAttribute('d', '');
        return;
      }
      const clamped = Math.min(max, Math.max(min, value));
      const angle = -135 + (270 * (clamped - min)) / span;
      fill.setAttribute('d', arcPath(55, 52, 38, -135, angle));
      valueText.textContent = `${value.toFixed(1)}${meta?.unit ? ' ' + meta.unit : ''}`;
    },
  };
}

// ---- SVG helpers ----

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Angle in degrees, 0 = up, positive clockwise. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 <= a0) a1 = a0 + 0.01;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

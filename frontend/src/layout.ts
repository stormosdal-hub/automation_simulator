/**
 * Panel-column layout: a draggable width handle on each fixed side column
 * (#panels right, #panels-left left), persisted to localStorage. The columns
 * themselves scroll vertically (CSS), individual panel bodies resize+scroll
 * (CSS `resize: vertical` + panel.ts height persistence) — this module only
 * owns the horizontal column width.
 */

const MIN_W = 220;
const MAX_W = 640;
const EDGE_GAP = 12; // each column sits this far from its viewport edge

interface ColumnSpec {
  el: HTMLElement;
  side: 'left' | 'right';
  storageKey: string;
  top: number;
}

export function initLayout(): void {
  const specs: ColumnSpec[] = [];
  const right = document.getElementById('panels');
  const left = document.getElementById('panels-left');
  if (right) specs.push({ el: right, side: 'right', storageKey: 'layout:panels:w', top: 52 });
  if (left) specs.push({ el: left, side: 'left', storageKey: 'layout:panelsLeft:w', top: 116 });

  for (const spec of specs) {
    const saved = Number(localStorage.getItem(spec.storageKey));
    if (saved >= MIN_W && saved <= MAX_W) spec.el.style.width = `${saved}px`;

    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    handle.dataset.role = `col-resize-${spec.side}`;
    handle.title = 'Drag to resize this column';
    handle.style.top = `${spec.top}px`;
    handle.style.bottom = '12px';
    document.body.appendChild(handle);

    const place = (): void => {
      const w = spec.el.getBoundingClientRect().width;
      if (spec.side === 'right') handle.style.right = `${EDGE_GAP + w}px`;
      else handle.style.left = `${EDGE_GAP + w}px`;
    };
    place();

    let dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      handle.classList.add('dragging');
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic/absent pointer id — dragging still works via the flag */
      }
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const raw = spec.side === 'right' ? window.innerWidth - EDGE_GAP - e.clientX : e.clientX - EDGE_GAP;
      const w = Math.max(MIN_W, Math.min(MAX_W, raw));
      spec.el.style.width = `${w}px`;
      place();
    });
    const end = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      try {
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      document.body.style.userSelect = '';
      localStorage.setItem(spec.storageKey, String(Math.round(spec.el.getBoundingClientRect().width)));
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);

    // keep the handle glued to the column edge as the viewport / panel stack changes
    window.addEventListener('resize', place);
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(spec.el);
  }
}

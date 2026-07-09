import type { MachineEngine } from './machines/engine';
import {
  MACHINE_CATALOG,
  machineDef,
  newMachine,
  paramsOf,
  type MachineInstance,
  type MachineKind,
  type TagSlotSpec,
} from './machines/types';
import type { ProjectStore } from './projectStore';
import type { Selection } from './selection';
import type { TagStore } from './tagStore';
import { button, div, formRow } from './ui';

interface Deps {
  projectStore: ProjectStore;
  tagStore: TagStore;
  engine: MachineEngine;
  selection: Selection;
}

/**
 * The machine library panel: add machines from the catalog, pick one (here or
 * by clicking it in the viewport), edit its placement/params/tag bindings,
 * drop parts, and toggle arrange mode (drag machines on the ground plane).
 */
export class MachinePanel {
  private selectedId: string | null = null;
  /** Set while one of our own inputs commits, so the store echo doesn't re-render under the cursor. */
  private muted = false;
  private listEl: HTMLElement;
  private propsEl: HTMLElement;

  constructor(
    private body: HTMLElement,
    private deps: Deps,
  ) {
    const addRow = div('machine-add-row');
    const kindSel = document.createElement('select');
    kindSel.dataset.role = 'machine-kind-select';
    for (const def of MACHINE_CATALOG) {
      const o = document.createElement('option');
      o.value = def.kind;
      o.textContent = def.label;
      kindSel.append(o);
    }
    const addBtn = button('+ Add', 'btn btn-small');
    addBtn.dataset.role = 'machine-add';
    addBtn.addEventListener('click', () => this.add(kindSel.value as MachineKind));
    addRow.append(kindSel, addBtn);

    const toolsRow = div('machine-tools');
    const arrange = button('Arrange: off', 'btn btn-small');
    arrange.dataset.role = 'machine-arrange';
    arrange.addEventListener('click', () => {
      const eng = this.deps.engine;
      eng.arrangeMode = !eng.arrangeMode;
      arrange.textContent = `Arrange: ${eng.arrangeMode ? 'ON' : 'off'}`;
      arrange.classList.toggle('active', eng.arrangeMode);
    });
    const drop = button('Drop part', 'btn btn-small');
    drop.dataset.role = 'machine-drop';
    drop.title = 'Drop a part above the selected machine (tip: Shift+click anywhere in the scene)';
    drop.addEventListener('click', () => this.dropPart());
    const clear = button('Clear parts', 'btn btn-small');
    clear.dataset.role = 'machine-clear';
    clear.addEventListener('click', () => this.deps.engine.clearParts());
    toolsRow.append(arrange, drop, clear);

    const hint = div('machine-hint dim');
    hint.textContent = 'Shift+click the scene to drop a part. Arrange mode: drag machines to move them.';

    this.listEl = div('machine-list');
    this.propsEl = div('machine-props');
    body.append(addRow, toolsRow, hint, this.listEl, this.propsEl);

    this.deps.projectStore.onChange(() => {
      if (!this.muted) this.render();
    });
    // clicking a machine in the viewport selects it here too
    this.deps.selection.onChange((name) => {
      if (!name?.startsWith('machine:')) return;
      const id = name.split(':')[1];
      if (id && id !== this.selectedId && this.machines().some((m) => m.id === id)) {
        this.selectedId = id;
        this.render();
      }
    });
    // live status/problem text refresh (labels only — never rebuilds inputs)
    window.setInterval(() => this.refreshStatus(), 1000);
    this.render();
  }

  private machines(): MachineInstance[] {
    return this.deps.projectStore.project.machines ?? [];
  }

  private add(kind: MachineKind): void {
    const m = newMachine(kind, 0, 3.6, this.machines());
    this.selectedId = m.id;
    this.deps.projectStore.upsertMachine(m);
  }

  private dropPart(): void {
    const m = this.machines().find((x) => x.id === this.selectedId) ?? this.machines()[0];
    const x = m?.x ?? 0;
    const z = m?.z ?? 0;
    if (!this.deps.engine.dropAt(x, 1.6, z)) {
      alert('Physics is unavailable in this browser — parts cannot be dropped.');
    }
  }

  private commit(m: MachineInstance): void {
    this.muted = true;
    try {
      this.deps.projectStore.upsertMachine(m);
    } finally {
      this.muted = false;
    }
  }

  private refreshStatus(): void {
    for (const row of this.listEl.querySelectorAll<HTMLElement>('.machine-row')) {
      const id = row.dataset['machine'];
      if (!id) continue;
      const info = row.querySelector<HTMLElement>('.machine-info');
      if (info) info.textContent = this.infoText(id);
    }
  }

  private infoText(id: string): string {
    const manual = this.deps.engine.hasManual(id) ? '✋ ' : '';
    const problem = this.deps.engine.problemFor(id);
    if (problem) return `${manual}⚠ ${problem}`;
    return manual + (this.deps.engine.statusFor(id) ?? '');
  }

  private render(): void {
    this.renderList();
    this.renderProps();
  }

  private renderList(): void {
    this.listEl.textContent = '';
    const machines = this.machines();
    if (!machines.length) {
      const empty = div('machine-empty dim');
      empty.textContent = 'No machines yet — add one above.';
      this.listEl.append(empty);
      return;
    }
    for (const m of machines) {
      const row = div('machine-row' + (m.id === this.selectedId ? ' selected' : ''));
      row.dataset['machine'] = m.id;
      row.dataset.role = 'machine-row';
      const label = div('machine-label');
      const name = document.createElement('b');
      name.textContent = m.name;
      const info = div('machine-info dim');
      info.textContent = this.infoText(m.id);
      label.append(name, info);
      label.addEventListener('click', () => {
        this.selectedId = m.id;
        this.render();
      });
      const del = button('✕', 'icon-btn');
      del.dataset.role = 'machine-remove';
      del.title = 'Remove machine';
      del.addEventListener('click', () => {
        if (!confirm(`Remove "${m.name}"?`)) return;
        if (this.selectedId === m.id) this.selectedId = null;
        this.deps.projectStore.removeMachine(m.id);
      });
      row.append(label, del);
      this.listEl.append(row);
    }
  }

  private renderProps(): void {
    this.propsEl.textContent = '';
    const m = this.machines().find((x) => x.id === this.selectedId);
    if (!m) return;
    const def = machineDef(m.kind);
    // commits skip the re-render (muted), so closures must re-read the live
    // machine — otherwise editing X then Z would commit Z over a stale X
    const cur = (): MachineInstance => this.machines().find((x) => x.id === m.id) ?? m;

    const head = div('machine-props-head');
    head.textContent = def.label;
    const desc = div('machine-hint dim');
    desc.textContent = def.description;
    this.propsEl.append(head, desc);

    // name + placement
    this.propsEl.append(formRow('Name', this.text(m.name, (v) => this.commit({ ...cur(), name: v }), 'machine-name')));
    const grid = div('form-grid2');
    grid.append(
      formRow('X (m)', this.num(m.x, 0.1, (v) => this.commit({ ...cur(), x: v }), 'machine-x')),
      formRow('Z (m)', this.num(m.z, 0.1, (v) => this.commit({ ...cur(), z: v }), 'machine-z')),
    );
    this.propsEl.append(grid);
    const rotRow = div('machine-rot-row');
    const rotInput = this.num(m.rotY, 15, (v) => this.commit({ ...cur(), rotY: v }), 'machine-rot');
    const turn = button('↻ 90°', 'btn btn-small');
    turn.dataset.role = 'machine-turn';
    turn.addEventListener('click', () => this.commit({ ...cur(), rotY: (cur().rotY + 90) % 360 }));
    rotRow.append(rotInput, turn);
    this.propsEl.append(formRow('Rotation (°)', rotRow));

    // params
    const params = paramsOf(m);
    for (const spec of def.params) {
      const value = params[spec.key];
      let control: HTMLElement;
      if (spec.type === 'boolean') {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = value === true;
        cb.dataset.role = 'machine-prop';
        cb.dataset['key'] = spec.key;
        cb.addEventListener('change', () => {
          const c = cur();
          this.commit({ ...c, params: { ...c.params, [spec.key]: cb.checked } });
        });
        control = cb;
      } else if (spec.type === 'choice') {
        const sel = document.createElement('select');
        sel.dataset.role = 'machine-prop';
        sel.dataset['key'] = spec.key;
        for (const c of spec.choices ?? []) {
          const o = document.createElement('option');
          o.value = c;
          o.textContent = c;
          sel.append(o);
        }
        sel.value = String(value);
        sel.addEventListener('change', () => {
          const c = cur();
          this.commit({ ...c, params: { ...c.params, [spec.key]: sel.value } });
        });
        control = sel;
      } else {
        control = this.num(
          typeof value === 'number' ? value : 0,
          spec.step ?? 0.1,
          (v) => {
            const c = cur();
            this.commit({ ...c, params: { ...c.params, [spec.key]: v } });
          },
          'machine-prop',
          spec.key,
          spec.min,
          spec.max,
        );
      }
      this.propsEl.append(formRow(spec.label, control));
    }

    // tag bindings
    if (def.tagSlots.length) {
      const title = div('machine-slots-title');
      title.textContent = 'Tag bindings';
      this.propsEl.append(title);
      for (const slot of def.tagSlots) {
        this.propsEl.append(formRow(`${slot.label} (${slot.dir})`, this.tagSelect(cur, slot)));
        const hint = div('machine-hint dim');
        hint.textContent = slot.hint;
        this.propsEl.append(hint);
      }
    }

    // manual override ("relay test buttons") — runtime-only, never saved
    const manualEls = this.manualSection(m);
    if (manualEls.length) {
      const title = div('machine-slots-title');
      title.textContent = 'Manual override';
      this.propsEl.append(title, ...manualEls);
    }

    if (m.kind === 'spawner') {
      const now = button('Drop now', 'btn btn-small');
      now.dataset.role = 'machine-dropnow';
      now.addEventListener('click', () => this.deps.engine.manualDrop(m.id));
      const row = div('btn-row');
      row.append(now);
      this.propsEl.append(row);
    }
  }

  /** Auto | On | Off segments (+ speed slider / actions) per machine kind. */
  private manualSection(m: MachineInstance): HTMLElement[] {
    const eng = this.deps.engine;
    const rerender = () => {
      this.renderProps();
      this.refreshStatus();
    };
    const seg = (key: string, onLabel: string, offLabel: string): HTMLElement => {
      const cur = eng.manualState(m.id)[key];
      const row = div('machine-seg');
      row.dataset.role = 'machine-manual';
      row.dataset['key'] = key;
      const mk = (label: string, val: boolean | undefined, active: boolean) => {
        const b = button(label, 'seg-btn' + (active ? ' active' : ''));
        b.dataset['val'] = String(val);
        b.addEventListener('click', () => {
          eng.setManual(m.id, key, val);
          rerender();
        });
        return b;
      };
      row.append(
        mk('Auto', undefined, cur === undefined),
        mk(onLabel, true, cur === true),
        mk(offLabel, false, cur === false),
      );
      return row;
    };
    const speedRow = (): HTMLElement => {
      const cur = eng.manualState(m.id)['speed'];
      const row = div('machine-speed-row');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = typeof cur === 'number';
      cb.dataset.role = 'machine-manual-speed-on';
      cb.title = 'Override speed';
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.step = '5';
      range.value = String(typeof cur === 'number' ? cur : 100);
      range.disabled = !cb.checked;
      range.dataset.role = 'machine-manual-speed';
      const label = document.createElement('span');
      label.className = 'machine-speed-val';
      label.textContent = `${range.value}%`;
      cb.addEventListener('change', () => {
        eng.setManual(m.id, 'speed', cb.checked ? parseFloat(range.value) : undefined);
        rerender();
      });
      range.addEventListener('input', () => {
        label.textContent = `${range.value}%`;
        eng.setManual(m.id, 'speed', parseFloat(range.value)); // no rerender — keep the slider in hand
      });
      row.append(cb, range, label);
      return formRow('Speed override', row);
    };
    switch (m.kind) {
      case 'conveyor':
      case 'curve':
        return [formRow('Motor', seg('motor', 'Run', 'Stop')), speedRow()];
      case 'turntable':
        return [formRow('Rotate', seg('rotate', 'Rotate', 'Home')), speedRow()];
      case 'pusher':
        return [formRow('Cylinder', seg('extend', 'Extend', 'Retract'))];
      case 'gate':
        return [formRow('Blade', seg('raise', 'Raise', 'Lower'))];
      case 'photoeye':
        return [formRow('Force sensor', seg('blocked', 'Blocked', 'Clear'))];
      case 'stacklight':
        return [formRow('Lamp test', seg('test', 'All on', 'All off'))];
      case 'bin': {
        const reset = button('Reset count', 'btn btn-small');
        reset.dataset.role = 'machine-reset-count';
        reset.addEventListener('click', () => {
          eng.runAction(m.id, 'reset');
          this.refreshStatus();
        });
        const row = div('btn-row');
        row.append(reset);
        return [row];
      }
      default:
        return [];
    }
  }

  private tagSelect(cur: () => MachineInstance, slot: TagSlotSpec): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.dataset.role = 'machine-tag';
    sel.dataset['slot'] = slot.key;
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '(unbound)';
    sel.append(blank);
    const current = cur().tags[slot.key] ?? '';
    const ids = this.deps.tagStore
      .rows()
      .filter((r) => r.meta.dataType === slot.dataType && (slot.dir === 'read' || r.meta.writable === true))
      .map((r) => r.meta.id);
    if (current && !ids.includes(current)) ids.unshift(current); // keep a missing tag visible
    for (const id of ids) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      sel.append(o);
    }
    sel.value = current;
    sel.addEventListener('change', () => {
      const c = cur();
      const tags = { ...c.tags };
      if (sel.value) tags[slot.key] = sel.value;
      else delete tags[slot.key];
      this.commit({ ...c, tags });
    });
    return sel;
  }

  private num(
    value: number,
    step: number,
    onCommit: (v: number) => void,
    role: string,
    key?: string,
    min?: number,
    max?: number,
  ): HTMLInputElement {
    const el = document.createElement('input');
    el.type = 'number';
    el.step = String(step);
    if (min !== undefined) el.min = String(min);
    if (max !== undefined) el.max = String(max);
    el.value = String(value);
    el.dataset.role = role;
    if (key) el.dataset['key'] = key;
    el.addEventListener('change', () => {
      let v = parseFloat(el.value);
      if (!Number.isFinite(v)) return;
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
      el.value = String(v);
      onCommit(v);
    });
    return el;
  }

  private text(value: string, onCommit: (v: string) => void, role: string): HTMLInputElement {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = value;
    el.dataset.role = role;
    el.addEventListener('change', () => {
      if (el.value.trim()) onCommit(el.value.trim());
    });
    return el;
  }
}

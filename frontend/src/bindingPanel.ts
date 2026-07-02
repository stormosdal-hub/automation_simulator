import type { Binding, BindingProperty, Project, TransformSpec, TransformValue } from './bindings/types';
import {
  BINDABLE_PROPERTIES,
  defaultTransformFor,
  defaultTransformOfKind,
  transformKindsFor,
} from './bindings/types';
import type { BindingEngine } from './bindings/engine';
import { newBindingId, type ProjectStore } from './projectStore';
import type { Selection } from './selection';
import type { TagStore } from './tagStore';

interface Deps {
  projectStore: ProjectStore;
  tagStore: TagStore;
  selection: Selection;
  engine: BindingEngine;
  nodeNames: () => string[];
}

/** Binding list + add/edit form + project export/import/reset. */
export class BindingPanel {
  private draft: Binding | null = null;

  constructor(
    private host: HTMLElement,
    private deps: Deps,
  ) {
    deps.projectStore.onChange(() => this.render());
    this.render();
  }

  /** Re-render after the scene loads so node dropdowns and problem badges are current. */
  refresh(): void {
    this.render();
  }

  private render(): void {
    this.host.innerHTML = '';
    this.host.append(this.renderList());
    if (this.draft) this.host.append(this.renderForm(this.draft));
    else {
      const add = button('+ Add binding', 'btn');
      add.dataset.role = 'add-binding';
      add.addEventListener('click', () => {
        this.draft = {
          id: newBindingId(),
          nodeId: this.deps.selection.name ?? this.deps.nodeNames()[0] ?? '',
          property: 'rotation.z',
          tagId: this.deps.tagStore.rows()[0]?.meta.id ?? '',
          transform: defaultTransformFor('rotation.z'),
        };
        this.render();
      });
      const row = div('btn-row');
      row.append(add);
      this.host.append(row);
    }
    this.host.append(this.renderProjectRow());
  }

  private renderList(): HTMLElement {
    const wrap = div('');
    const bindings = this.deps.projectStore.project.bindings;
    if (bindings.length === 0) {
      wrap.append(Object.assign(div('dim'), { textContent: 'no bindings yet' }));
      return wrap;
    }
    for (const b of bindings) {
      const row = div('binding-row');
      row.dataset.bindingId = b.id;
      const problem = this.deps.engine.getProblem(b.id);
      const desc = div('binding-desc');
      desc.innerHTML =
        (problem ? `<span class="warn" title="${problem}">⚠</span> ` : '') +
        `${b.nodeId} <span class="dim">· ${b.property} ←</span> ${b.tagId} ` +
        `<span class="dim">[${b.transform.kind}]</span>`;
      const edit = button('✎', 'icon-btn');
      edit.title = 'edit';
      edit.addEventListener('click', () => {
        this.draft = structuredClone(b);
        this.render();
      });
      const del = button('×', 'icon-btn');
      del.title = 'delete';
      del.dataset.role = 'delete-binding';
      del.addEventListener('click', () => this.deps.projectStore.removeBinding(b.id));
      row.append(desc, edit, del);
      wrap.append(row);
    }
    return wrap;
  }

  private renderForm(draft: Binding): HTMLElement {
    const form = div('binding-form');

    // node
    const nodeSelect = select(
      dedupe([...this.deps.nodeNames(), ...(draft.nodeId ? [draft.nodeId] : [])]),
      draft.nodeId,
    );
    nodeSelect.dataset.role = 'node-select';
    nodeSelect.addEventListener('change', () => (draft.nodeId = nodeSelect.value));
    const useSelected = button('◎ selected', 'btn btn-small');
    useSelected.title = 'use the node selected in the tree/viewport';
    useSelected.addEventListener('click', () => {
      const name = this.deps.selection.name;
      if (name) {
        draft.nodeId = name;
        this.render();
      }
    });
    const nodeRow = div('inline-row');
    nodeRow.append(nodeSelect, useSelected);
    form.append(formRow('node', nodeRow));

    // property
    const propSelect = select([...BINDABLE_PROPERTIES], draft.property);
    propSelect.dataset.role = 'property-select';
    propSelect.addEventListener('change', () => {
      draft.property = propSelect.value as BindingProperty;
      if (!transformKindsFor(draft.property).includes(draft.transform.kind)) {
        draft.transform = defaultTransformFor(draft.property);
      } else {
        draft.transform = defaultTransformOfKind(draft.transform.kind, draft.property);
      }
      this.render();
    });
    form.append(formRow('property', propSelect));

    // tag
    const tagIds = dedupe([
      ...this.deps.tagStore.rows().map((r) => r.meta.id),
      ...(draft.tagId ? [draft.tagId] : []),
    ]);
    const tagSelect = select(tagIds, draft.tagId);
    tagSelect.dataset.role = 'tag-select';
    tagSelect.addEventListener('change', () => (draft.tagId = tagSelect.value));
    form.append(formRow('tag', tagSelect));

    // transform kind
    const kindSelect = select(transformKindsFor(draft.property), draft.transform.kind);
    kindSelect.dataset.role = 'kind-select';
    kindSelect.addEventListener('change', () => {
      draft.transform = defaultTransformOfKind(
        kindSelect.value as TransformSpec['kind'],
        draft.property,
      );
      this.render();
    });
    form.append(formRow('transform', kindSelect));

    // kind-specific params
    form.append(this.renderParams(draft));

    // save / cancel
    const save = button('Save', 'btn');
    save.dataset.role = 'save-binding';
    save.addEventListener('click', () => {
      const error = validate(draft);
      if (error) {
        alert(error);
        return;
      }
      this.draft = null;
      this.deps.projectStore.upsertBinding(draft);
    });
    const cancel = button('Cancel', 'btn');
    cancel.addEventListener('click', () => {
      this.draft = null;
      this.render();
    });
    const btns = div('btn-row');
    btns.append(save, cancel);
    form.append(btns);
    return form;
  }

  private renderParams(draft: Binding): HTMLElement {
    const wrap = div('transform-params');
    const t = draft.transform;

    if (t.kind === 'linear') {
      const grid = div('form-grid2');
      grid.append(
        labeledNumber('in min', t.inMin, (v) => (t.inMin = v)),
        labeledNumber('in max', t.inMax, (v) => (t.inMax = v)),
        labeledNumber('out min', t.outMin, (v) => (t.outMin = v)),
        labeledNumber('out max', t.outMax, (v) => (t.outMax = v)),
      );
      wrap.append(grid);
    }

    if (t.kind === 'boolean') {
      const grid = div('form-grid2');
      grid.append(
        labeledValue('when true', draft.property, t.whenTrue, (v) => (t.whenTrue = v)),
        labeledValue('when false', draft.property, t.whenFalse, (v) => (t.whenFalse = v)),
      );
      wrap.append(grid);
    }

    if (t.kind === 'threshold') {
      for (let i = 0; i < t.stops.length; i++) {
        const stop = t.stops[i]!;
        const row = div('stop-row');
        if (stop.upTo === null) {
          const label = div('dim');
          label.textContent = 'else';
          label.style.minWidth = '72px';
          row.append(label);
        } else {
          const upTo = numberInput(stop.upTo, (v) => (stop.upTo = v));
          upTo.title = 'value ≤';
          upTo.style.maxWidth = '72px';
          row.append(upTo);
        }
        row.append(valueInput(draft.property, stop.value, (v) => (stop.value = v)));
        if (stop.upTo !== null) {
          const del = button('×', 'icon-btn');
          del.addEventListener('click', () => {
            t.stops.splice(i, 1);
            this.render();
          });
          row.append(del);
        }
        wrap.append(row);
      }
      const add = button('+ stop', 'btn btn-small');
      add.addEventListener('click', () => {
        const lastNumeric = [...t.stops].reverse().find((s) => s.upTo !== null);
        const prevValue = t.stops[t.stops.length - 1]?.value ?? 0;
        t.stops.splice(Math.max(0, t.stops.length - 1), 0, {
          upTo: (typeof lastNumeric?.upTo === 'number' ? lastNumeric.upTo : 0) + 10,
          value: prevValue,
        });
        this.render();
      });
      wrap.append(add);
    }

    return wrap;
  }

  private renderProjectRow(): HTMLElement {
    const row = div('btn-row project-row');
    const store = this.deps.projectStore;

    const exportBtn = button('Export', 'btn btn-small');
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([store.export()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${store.project.name.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    const importBtn = button('Import', 'btn btn-small');
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.style.display = 'none';
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const parsed = JSON.parse(await f.text()) as Project;
        if (parsed.version !== 1 || !Array.isArray(parsed.bindings)) {
          throw new Error('not an automation-sim project file');
        }
        store.replace(parsed);
      } catch (err) {
        alert(`import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      file.value = '';
    });
    importBtn.addEventListener('click', () => file.click());

    const resetBtn = button('Reset', 'btn btn-small');
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset project to defaults? This discards your bindings.')) store.reset();
    });

    row.append(exportBtn, importBtn, file, resetBtn);
    return row;
  }
}

// ---- small DOM helpers ----

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  if (className) el.className = className;
  return el;
}

function button(text: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = text;
  el.className = className;
  el.type = 'button';
  return el;
}

function select(options: string[], value: string): HTMLSelectElement {
  const el = document.createElement('select');
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    el.append(o);
  }
  el.value = value;
  return el;
}

function formRow(label: string, control: HTMLElement): HTMLElement {
  const row = div('form-row');
  const l = document.createElement('label');
  l.textContent = label;
  row.append(l, control);
  return row;
}

function numberInput(value: number, onInput: (v: number) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'number';
  el.step = 'any';
  el.value = String(value);
  el.addEventListener('input', () => onInput(parseFloat(el.value)));
  return el;
}

function labeledNumber(label: string, value: number, onInput: (v: number) => void): HTMLElement {
  const wrap = div('form-row');
  const l = document.createElement('label');
  l.textContent = label;
  wrap.append(l, numberInput(value, onInput));
  return wrap;
}

/** Value editor whose input type follows the target property: color, checkbox, or number. */
function valueInput(
  property: BindingProperty,
  value: TransformValue,
  onInput: (v: TransformValue) => void,
): HTMLElement {
  if (property === 'material.emissive') {
    const el = document.createElement('input');
    el.type = 'color';
    el.value = typeof value === 'string' ? value : '#000000';
    el.addEventListener('input', () => onInput(el.value));
    return el;
  }
  if (property === 'visible') {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.checked = value === true;
    el.addEventListener('change', () => onInput(el.checked));
    return el;
  }
  return numberInput(typeof value === 'number' ? value : 0, onInput);
}

function labeledValue(
  label: string,
  property: BindingProperty,
  value: TransformValue,
  onInput: (v: TransformValue) => void,
): HTMLElement {
  const wrap = div('form-row');
  const l = document.createElement('label');
  l.textContent = label;
  wrap.append(l, valueInput(property, value, onInput));
  return wrap;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

function validate(b: Binding): string | null {
  if (!b.nodeId) return 'pick a node';
  if (!b.tagId) return 'pick a tag';
  const t = b.transform;
  if (t.kind === 'linear') {
    for (const n of [t.inMin, t.inMax, t.outMin, t.outMax]) {
      if (!Number.isFinite(n)) return 'linear transform has an invalid number';
    }
  }
  if (t.kind === 'threshold') {
    if (t.stops.length === 0) return 'threshold needs at least one stop';
    for (const s of t.stops) {
      if (s.upTo !== null && !Number.isFinite(s.upTo)) return 'threshold stop has an invalid number';
    }
    if (t.stops[t.stops.length - 1]!.upTo !== null) return 'last threshold stop must be the else bucket';
  }
  return null;
}

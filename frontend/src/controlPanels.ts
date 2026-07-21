import type { ControlPanelDef, Widget, WidgetType } from './bindings/types';
import { widgetAcceptsTag } from './bindings/types';
import { createPanel } from './panel';
import { panelRegistry } from './panelRegistry';
import { newBindingId, type ProjectStore } from './projectStore';
import type { TagStore } from './tagStore';
import type { WidgetInstance } from './widgets';
import { buildWidget } from './widgets';
import type { GatewayConnection } from './wsClient';

const REFRESH_MS = 150;
const WIDGET_TYPES: WidgetType[] = ['switch', 'button', 'knob', 'led', 'gauge'];

interface Deps {
  projectStore: ProjectStore;
  store: TagStore;
  conn: GatewayConnection;
}

/**
 * Renders every control panel in the project as a collapsible overlay panel.
 * Per-panel edit mode (✎ in the header) adds widget/panel management.
 */
export class ControlPanels {
  private container: HTMLElement;
  private instances: { tagId: string; instance: WidgetInstance }[] = [];
  private editing = new Set<string>();

  constructor(
    host: HTMLElement,
    private deps: Deps,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'control-panels';
    host.append(this.container);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-small';
    addBtn.textContent = '+ Control panel';
    addBtn.dataset.role = 'add-panel';
    addBtn.addEventListener('click', () => {
      const title = prompt('Panel title:', 'Control panel');
      if (!title) return;
      const id = this.deps.projectStore.addPanel(title);
      this.editing.add(id);
      this.rebuild();
    });
    host.append(addBtn);

    deps.projectStore.onChange(() => this.rebuild());
    this.rebuild();
    setInterval(() => this.refreshValues(), REFRESH_MS);
  }

  private rebuild(): void {
    this.container.innerHTML = '';
    this.instances = [];
    const liveIds = new Set(this.deps.projectStore.project.panels.map((p) => `cp:${p.id}`));
    // drop registry entries for control panels that no longer exist
    for (const entry of panelRegistry.list()) {
      if (entry.id.startsWith('cp:') && !liveIds.has(entry.id)) panelRegistry.unregister(entry.id);
    }
    for (const def of this.deps.projectStore.project.panels) {
      this.renderPanel(def);
    }
  }

  private refreshValues(): void {
    for (const { tagId, instance } of this.instances) {
      const age = this.deps.store.ageMs(tagId);
      instance.el.classList.toggle('stale', age === null || age > 3000);
      instance.update(this.deps.store.raw(tagId), this.deps.store.metaFor(tagId));
    }
  }

  private renderPanel(def: ControlPanelDef): void {
    const isEditing = this.editing.has(def.id);

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'edit panel';
    editBtn.dataset.role = 'edit-panel';
    editBtn.addEventListener('click', () => {
      if (isEditing) this.editing.delete(def.id);
      else this.editing.add(def.id);
      this.rebuild();
    });

    const panel = createPanel(def.title, this.container, [editBtn], { id: `cp:${def.id}`, column: 'right' });
    panel.root.dataset.panelId = def.id;

    const grid = document.createElement('div');
    grid.className = 'widget-grid';
    panel.body.append(grid);

    if (def.widgets.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dim';
      empty.textContent = 'no widgets — use ✎ to add some';
      grid.append(empty);
    }

    for (const widget of def.widgets) {
      const instance = buildWidget(widget, this.deps);
      if (isEditing) {
        const del = document.createElement('button');
        del.className = 'icon-btn widget-delete';
        del.textContent = '×';
        del.title = 'remove widget';
        del.addEventListener('click', () => this.deps.projectStore.removeWidget(def.id, widget.id));
        instance.el.append(del);
      }
      grid.append(instance.el);
      this.instances.push({ tagId: widget.tagId, instance });
    }

    if (isEditing) panel.body.append(this.renderEditor(def));
  }

  private renderEditor(def: ControlPanelDef): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'panel-editor';

    const draft: Widget = {
      id: newBindingId(),
      type: 'led',
      label: '',
      tagId: '',
      config: {},
    };

    const render = () => {
      wrap.innerHTML = '';

      const typeSelect = select(WIDGET_TYPES, draft.type);
      typeSelect.dataset.role = 'widget-type';
      typeSelect.addEventListener('change', () => {
        draft.type = typeSelect.value as WidgetType;
        draft.tagId = '';
        render();
      });
      wrap.append(formRow('widget', typeSelect));

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.placeholder = 'label';
      labelInput.value = draft.label;
      labelInput.dataset.role = 'widget-label';
      labelInput.addEventListener('input', () => (draft.label = labelInput.value));
      wrap.append(formRow('label', labelInput));

      const eligible = this.deps.store
        .rows()
        .map((r) => r.meta)
        .filter((m) => widgetAcceptsTag(draft.type, m))
        .map((m) => m.id);
      const tagSelect = select(eligible, draft.tagId || (eligible[0] ?? ''));
      draft.tagId = tagSelect.value;
      tagSelect.dataset.role = 'widget-tag';
      tagSelect.addEventListener('change', () => (draft.tagId = tagSelect.value));
      wrap.append(formRow('tag', tagSelect));

      if (draft.type === 'knob' || draft.type === 'gauge') {
        const grid = document.createElement('div');
        grid.className = 'form-grid2';
        grid.append(
          formRow('min', numberInput(draft.config?.min ?? 0, (v) => (draft.config = { ...draft.config, min: v }))),
          formRow('max', numberInput(draft.config?.max ?? 100, (v) => (draft.config = { ...draft.config, max: v }))),
        );
        wrap.append(grid);
      }
      if (draft.type === 'led') {
        const grid = document.createElement('div');
        grid.className = 'form-grid2';
        grid.append(
          formRow('on color', colorInput(draft.config?.onColor ?? '#26f259', (v) => (draft.config = { ...draft.config, onColor: v }))),
          formRow('off color', colorInput(draft.config?.offColor ?? '#3a3f46', (v) => (draft.config = { ...draft.config, offColor: v }))),
        );
        wrap.append(grid);
      }

      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-small';
      addBtn.type = 'button';
      addBtn.textContent = '+ Add widget';
      addBtn.dataset.role = 'add-widget';
      addBtn.addEventListener('click', () => {
        if (!draft.tagId) {
          alert('no eligible tag for this widget type');
          return;
        }
        if (!draft.label) draft.label = draft.tagId.split('.').pop() ?? draft.tagId;
        this.deps.projectStore.upsertWidget(def.id, structuredClone(draft));
      });

      const delPanel = document.createElement('button');
      delPanel.className = 'btn btn-small';
      delPanel.type = 'button';
      delPanel.textContent = 'Delete panel';
      delPanel.addEventListener('click', () => {
        if (confirm(`Delete panel '${def.title}' and its widgets?`)) {
          this.editing.delete(def.id);
          this.deps.projectStore.removePanel(def.id);
        }
      });

      const btns = document.createElement('div');
      btns.className = 'btn-row';
      btns.append(addBtn, delPanel);
      wrap.append(btns);
    };
    render();
    return wrap;
  }
}

// ---- small DOM helpers ----

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
  const row = document.createElement('div');
  row.className = 'form-row';
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

function colorInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'color';
  el.value = value;
  el.addEventListener('input', () => onInput(el.value));
  return el;
}

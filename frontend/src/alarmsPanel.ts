import type { AlarmCondition, AlarmRule } from './bindings/types';
import { alarmActive } from './bindings/types';
import type { Panel } from './panel';
import { newBindingId, type ProjectStore } from './projectStore';
import type { TagStore } from './tagStore';
import { button, div, formRow, numberInput, select, textInput } from './ui';

const TICK_MS = 300;

/**
 * Evaluates the project's alarm rules against live values and renders the
 * active list + a rule editor. Alarms clear themselves when the condition
 * clears; the panel title carries the active count.
 */
export class AlarmsPanel {
  private active = new Map<string, number>(); // ruleId -> activatedAt
  private titleEl: HTMLElement | null;
  private adding = false;

  constructor(
    private panel: Panel,
    private projectStore: ProjectStore,
    private store: TagStore,
  ) {
    this.titleEl = panel.root.querySelector('.panel-header span');
    projectStore.onChange(() => this.render());
    setInterval(() => this.tick(), TICK_MS);
    this.render();
  }

  private tick(): void {
    const rules = this.projectStore.project.alarms;
    let changed = false;
    for (const rule of rules) {
      const isActive = alarmActive(rule, this.store.raw(rule.tagId));
      const wasActive = this.active.has(rule.id);
      if (isActive && !wasActive) {
        this.active.set(rule.id, Date.now());
        changed = true;
      } else if (!isActive && wasActive) {
        this.active.delete(rule.id);
        changed = true;
      }
    }
    for (const id of [...this.active.keys()]) {
      if (!rules.some((r) => r.id === id)) {
        this.active.delete(id);
        changed = true;
      }
    }
    if (changed) this.render();
    else this.refreshDurations();
  }

  private refreshDurations(): void {
    for (const el of this.panel.body.querySelectorAll<HTMLElement>('[data-alarm-since]')) {
      const since = Number(el.dataset.alarmSince);
      el.textContent = formatDuration(Date.now() - since);
    }
  }

  private render(): void {
    const rules = this.projectStore.project.alarms;
    const activeRules = rules.filter((r) => this.active.has(r.id));
    if (this.titleEl) {
      this.titleEl.textContent = activeRules.length > 0 ? `Alarms (${activeRules.length})` : 'Alarms';
    }
    this.panel.root.classList.toggle('has-alarms', activeRules.length > 0);
    this.panel.body.innerHTML = '';

    // active list
    if (activeRules.length === 0) {
      const ok = div('dim');
      ok.textContent = 'no active alarms';
      this.panel.body.append(ok);
    }
    for (const rule of activeRules) {
      const since = this.active.get(rule.id) ?? Date.now();
      const row = div(`alarm-row active ${rule.severity}`);
      row.dataset.alarmId = rule.id;
      const value = this.store.raw(rule.tagId);
      row.innerHTML =
        `<span class="alarm-dot"></span><div class="alarm-text"><b>${rule.message}</b>` +
        `<span class="dim">${rule.tagId} = ${typeof value === 'number' ? value.toFixed(1) : String(value)}` +
        ` · <span data-alarm-since="${since}">${formatDuration(Date.now() - since)}</span></span></div>`;
      this.panel.body.append(row);
    }

    // configured rules
    const rulesHeader = div('dim rules-header');
    rulesHeader.textContent = 'rules';
    this.panel.body.append(rulesHeader);
    for (const rule of rules) {
      const row = div('alarm-rule-row');
      const cond =
        rule.condition === 'gt' ? `> ${rule.threshold}` : rule.condition === 'lt' ? `< ${rule.threshold}` : `is ${rule.condition}`;
      const desc = div('binding-desc');
      desc.innerHTML = `${rule.tagId} <span class="dim">${cond} → ${rule.severity}</span>`;
      const del = button('×', 'icon-btn');
      del.title = 'delete rule';
      del.addEventListener('click', () => this.projectStore.removeAlarm(rule.id));
      row.append(desc, del);
      this.panel.body.append(row);
    }

    if (this.adding) this.panel.body.append(this.renderForm());
    else {
      const add = button('+ Add rule', 'btn btn-small');
      add.dataset.role = 'add-alarm';
      add.addEventListener('click', () => {
        this.adding = true;
        this.render();
      });
      const rowBtns = div('btn-row');
      rowBtns.append(add);
      this.panel.body.append(rowBtns);
    }
  }

  private renderForm(): HTMLElement {
    const wrap = div('panel-editor');
    const tags = this.store.rows().map((r) => r.meta);
    const draft: AlarmRule = {
      id: newBindingId(),
      tagId: tags[0]?.id ?? '',
      condition: 'gt',
      threshold: 50,
      severity: 'warning',
      message: '',
    };

    const render = () => {
      wrap.innerHTML = '';
      const tagSelect = select(tags.map((t) => t.id), draft.tagId);
      tagSelect.addEventListener('change', () => {
        draft.tagId = tagSelect.value;
        const meta = tags.find((t) => t.id === draft.tagId);
        draft.condition = meta?.dataType === 'boolean' ? 'true' : 'gt';
        render();
      });
      wrap.append(formRow('tag', tagSelect));

      const meta = tags.find((t) => t.id === draft.tagId);
      const conditions: AlarmCondition[] = meta?.dataType === 'boolean' ? ['true', 'false'] : ['gt', 'lt'];
      if (!conditions.includes(draft.condition)) draft.condition = conditions[0]!;
      const condSelect = select(conditions, draft.condition);
      condSelect.addEventListener('change', () => {
        draft.condition = condSelect.value as AlarmCondition;
        render();
      });
      wrap.append(formRow('condition', condSelect));

      if (draft.condition === 'gt' || draft.condition === 'lt') {
        wrap.append(formRow('threshold', numberInput(draft.threshold ?? 0, (v) => (draft.threshold = v))));
      }
      const sevSelect = select(['warning', 'critical'], draft.severity);
      sevSelect.addEventListener('change', () => (draft.severity = sevSelect.value as AlarmRule['severity']));
      wrap.append(formRow('severity', sevSelect));
      wrap.append(formRow('message', textInput(draft.message, 'alarm message', (v) => (draft.message = v))));

      const save = button('Save', 'btn btn-small');
      save.dataset.role = 'save-alarm';
      save.addEventListener('click', () => {
        if (!draft.tagId) return alert('pick a tag');
        if ((draft.condition === 'gt' || draft.condition === 'lt') && !Number.isFinite(draft.threshold))
          return alert('threshold must be a number');
        if (!draft.message) draft.message = `${draft.tagId} alarm`;
        this.adding = false;
        this.projectStore.upsertAlarm(draft);
      });
      const cancel = button('Cancel', 'btn btn-small');
      cancel.addEventListener('click', () => {
        this.adding = false;
        this.render();
      });
      const btns = div('btn-row');
      btns.append(save, cancel);
      wrap.append(btns);
    };
    render();
    return wrap;
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

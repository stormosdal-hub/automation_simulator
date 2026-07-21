import type { AlarmRule, Binding, ControlPanelDef, Project, Widget } from './bindings/types';
import type { MachineInstance } from './machines/types';

const STORAGE_KEY = 'automation-sim:project';

/** Retired demo GLB — saved projects still pointing at it are migrated away. */
const RETIRED_MODEL = '/models/demo-arm.glb';

/**
 * Machines-only starter project: no GLB model, so the scene is built entirely
 * from the machine library. Bindings stay supported for imported models.
 */
const DEFAULT_PROJECT: Project = {
  version: 1,
  name: 'Demo line',
  modelUrl: null,
  bindings: [],
  panels: [
    {
      id: 'default-panel',
      title: 'Machine control',
      widgets: [
        { id: 'w-run', type: 'switch', label: 'Run', tagId: 'sim.cmdRun' },
        { id: 'w-speed', type: 'knob', label: 'Speed', tagId: 'sim.speed', config: { min: 0, max: 100 } },
        { id: 'w-reset', type: 'button', label: 'Reset temp', tagId: 'sim.reset' },
        { id: 'w-running', type: 'led', label: 'Running', tagId: 'sim.running' },
        { id: 'w-temp', type: 'gauge', label: 'Temperature', tagId: 'sim.temperature', config: { min: 20, max: 80 } },
      ],
    },
  ],
  // a working physics line: dropper → conveyor (unbound = always running) → photo-eye → bin
  machines: [
    {
      id: 'demo-conv',
      kind: 'conveyor',
      name: 'Conveyor belt 1',
      x: 0,
      z: 2.3,
      rotY: 0,
      params: { length: 2.4, width: 0.6, height: 0.55, speed: 0.6 },
      tags: {},
    },
    {
      id: 'demo-drop',
      kind: 'spawner',
      name: 'Part dropper 1',
      x: -0.9,
      z: 2.3,
      rotY: 0,
      params: { dropY: 1.5, intervalS: 6, shape: 'box', size: 0.24 },
      tags: {},
    },
    {
      id: 'demo-eye',
      kind: 'photoeye',
      name: 'Photo-eye sensor 1',
      x: 0.35,
      z: 2.3,
      rotY: 0,
      params: { span: 0.9, beamY: 0.66, invert: false },
      tags: {},
    },
    {
      id: 'demo-bin',
      kind: 'bin',
      name: 'Collection bin 1',
      x: 1.68,
      z: 2.3,
      rotY: 0,
      params: { width: 0.75, depth: 0.75, consume: true },
      tags: {},
    },
  ],
  alarms: [
    {
      id: 'alarm-overheat',
      tagId: 'sim.temperature',
      condition: 'gt',
      threshold: 75,
      severity: 'warning',
      message: 'Demo machine overheating',
    },
    {
      id: 'alarm-plc-offline',
      tagId: 'plc1.online',
      condition: 'false',
      severity: 'critical',
      message: 'Conveyor PLC connection lost',
    },
    {
      id: 'alarm-mixer-temp',
      tagId: 'mixer1.motorTemp',
      condition: 'gt',
      threshold: 55,
      severity: 'critical',
      message: 'Mixer motor over temperature',
    },
  ],
};

export function newBindingId(): string {
  return `b-${crypto.randomUUID().slice(0, 8)}`;
}

export class ProjectStore {
  project: Project;
  private listeners = new Set<() => void>();

  constructor() {
    this.project = this.load();
  }

  private load(): Project {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Project;
        if (parsed.version === 1 && Array.isArray(parsed.bindings)) {
          // projects saved before Phase 4 have no panels — seed the defaults
          if (!Array.isArray(parsed.panels)) parsed.panels = structuredClone(DEFAULT_PROJECT.panels);
          if (!Array.isArray(parsed.alarms)) parsed.alarms = structuredClone(DEFAULT_PROJECT.alarms);
          // machines arrived later still — older saves just get none (not the demo line)
          if (!Array.isArray(parsed.machines)) parsed.machines = [];
          // the demo robot arm is gone: drop the model and the bindings that
          // targeted its nodes, which would otherwise 404 / bind to nothing
          if (parsed.modelUrl === RETIRED_MODEL) {
            parsed.modelUrl = null;
            parsed.bindings = [];
          }
          return parsed;
        }
      }
    } catch {
      // fall through to defaults on corrupt storage
    }
    return structuredClone(DEFAULT_PROJECT);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.project));
    for (const listener of this.listeners) listener();
  }

  upsertBinding(binding: Binding): void {
    const idx = this.project.bindings.findIndex((b) => b.id === binding.id);
    if (idx >= 0) this.project.bindings[idx] = binding;
    else this.project.bindings.push(binding);
    this.save();
  }

  removeBinding(id: string): void {
    this.project.bindings = this.project.bindings.filter((b) => b.id !== id);
    this.save();
  }

  replace(project: Project): void {
    if (!Array.isArray(project.panels)) project.panels = [];
    if (!Array.isArray(project.alarms)) project.alarms = [];
    if (!Array.isArray(project.machines)) project.machines = [];
    this.project = project;
    this.save();
  }

  upsertMachine(machine: MachineInstance): void {
    const idx = this.project.machines.findIndex((m) => m.id === machine.id);
    if (idx >= 0) this.project.machines[idx] = machine;
    else this.project.machines.push(machine);
    this.save();
  }

  removeMachine(id: string): void {
    this.project.machines = this.project.machines.filter((m) => m.id !== id);
    this.save();
  }

  upsertAlarm(rule: AlarmRule): void {
    const idx = this.project.alarms.findIndex((a) => a.id === rule.id);
    if (idx >= 0) this.project.alarms[idx] = rule;
    else this.project.alarms.push(rule);
    this.save();
  }

  removeAlarm(id: string): void {
    this.project.alarms = this.project.alarms.filter((a) => a.id !== id);
    this.save();
  }

  addPanel(title: string): string {
    const panel: ControlPanelDef = { id: newBindingId(), title, widgets: [] };
    this.project.panels.push(panel);
    this.save();
    return panel.id;
  }

  removePanel(panelId: string): void {
    this.project.panels = this.project.panels.filter((p) => p.id !== panelId);
    this.save();
  }

  upsertWidget(panelId: string, widget: Widget): void {
    const panel = this.project.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const idx = panel.widgets.findIndex((w) => w.id === widget.id);
    if (idx >= 0) panel.widgets[idx] = widget;
    else panel.widgets.push(widget);
    this.save();
  }

  removeWidget(panelId: string, widgetId: string): void {
    const panel = this.project.panels.find((p) => p.id === panelId);
    if (!panel) return;
    panel.widgets = panel.widgets.filter((w) => w.id !== widgetId);
    this.save();
  }

  reset(): void {
    this.project = structuredClone(DEFAULT_PROJECT);
    this.save();
  }

  export(): string {
    return JSON.stringify(this.project, null, 2);
  }
}

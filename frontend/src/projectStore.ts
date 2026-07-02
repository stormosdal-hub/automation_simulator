import type { AlarmRule, Binding, ControlPanelDef, Project, Widget } from './bindings/types';

const STORAGE_KEY = 'automation-sim:project';

/** Reproduces the original hardwired spike bindings through the engine, plus a threshold demo. */
const DEFAULT_PROJECT: Project = {
  version: 1,
  name: 'Demo arm',
  modelUrl: '/models/demo-arm.glb',
  bindings: [
    {
      id: 'default-arm',
      nodeId: 'ArmPivot',
      property: 'rotation.z',
      tagId: 'sim.armAngle',
      transform: { kind: 'passthrough' },
    },
    {
      id: 'default-forearm',
      nodeId: 'ForearmPivot',
      property: 'rotation.x',
      tagId: 'sim.forearmAngle',
      transform: { kind: 'passthrough' },
    },
    {
      id: 'default-lamp',
      nodeId: 'StatusLamp',
      property: 'material.emissive',
      tagId: 'sim.running',
      transform: { kind: 'boolean', whenTrue: '#26f259', whenFalse: '#730f0f' },
    },
    {
      id: 'default-temp-tint',
      nodeId: 'UpperArm',
      property: 'material.emissive',
      tagId: 'sim.temperature',
      transform: {
        kind: 'threshold',
        stops: [
          { upTo: 50, value: '#000000' },
          { upTo: 65, value: '#33230a' },
          { upTo: null, value: '#4d1111' },
        ],
      },
    },
  ],
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
    this.project = project;
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

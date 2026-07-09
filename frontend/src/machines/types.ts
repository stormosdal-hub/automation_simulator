/** The placeable machine library: instance schema + per-kind catalog. */

export type MachineKind =
  | 'conveyor'
  | 'curve'
  | 'turntable'
  | 'photoeye'
  | 'pusher'
  | 'gate'
  | 'bin'
  | 'spawner'
  | 'stacklight';

export type MachineParamValue = number | boolean | string;

/** One machine placed in the scene; lives in `project.machines`. */
export interface MachineInstance {
  id: string;
  kind: MachineKind;
  name: string;
  /** Ground-plane placement (y comes from the kind's geometry). */
  x: number;
  z: number;
  /** Yaw in degrees. 0 = the machine's "flow" axis points along +X. */
  rotY: number;
  params: Record<string, MachineParamValue>;
  /** Tag bindings by slot name (see catalog `tagSlots`); '' / absent = unbound. */
  tags: Record<string, string>;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'choice';
  default: MachineParamValue;
  min?: number;
  max?: number;
  step?: number;
  choices?: string[];
}

export interface TagSlotSpec {
  key: string;
  label: string;
  dataType: 'number' | 'boolean';
  /** read: machine is driven by the tag; write: machine writes the tag (needs writable). */
  dir: 'read' | 'write';
  hint: string;
}

export interface MachineDef {
  kind: MachineKind;
  label: string;
  description: string;
  params: ParamSpec[];
  tagSlots: TagSlotSpec[];
}

export const MACHINE_CATALOG: MachineDef[] = [
  {
    kind: 'conveyor',
    label: 'Conveyor belt',
    description: 'Carries dropped boxes along its axis while the motor runs.',
    params: [
      { key: 'length', label: 'Length (m)', type: 'number', default: 2.4, min: 0.6, max: 8, step: 0.1 },
      { key: 'width', label: 'Width (m)', type: 'number', default: 0.6, min: 0.25, max: 2, step: 0.05 },
      { key: 'height', label: 'Belt height (m)', type: 'number', default: 0.55, min: 0.2, max: 1.5, step: 0.05 },
      { key: 'rise', label: 'Rise (m, incline)', type: 'number', default: 0, min: -1.5, max: 1.5, step: 0.05 },
      { key: 'speed', label: 'Speed (m/s)', type: 'number', default: 0.6, min: 0.05, max: 3, step: 0.05 },
      { key: 'rails', label: 'Guard rails', type: 'choice', default: 'both', choices: ['both', 'left', 'right', 'none'] },
    ],
    tagSlots: [
      { key: 'motor', label: 'Motor (run)', dataType: 'boolean', dir: 'read', hint: 'belt runs while true; unbound = always run' },
      { key: 'speed', label: 'Speed (0–100%)', dataType: 'number', dir: 'read', hint: 'scales belt speed; unbound = 100%' },
    ],
  },
  {
    kind: 'curve',
    label: 'Curved conveyor',
    description: 'Arc belt that carries parts around a corner (entry along +X).',
    params: [
      { key: 'radius', label: 'Radius (m)', type: 'number', default: 0.8, min: 0.4, max: 3, step: 0.1 },
      { key: 'angleDeg', label: 'Turn (°, +left/−right)', type: 'number', default: 90, min: -180, max: 180, step: 15 },
      { key: 'width', label: 'Width (m)', type: 'number', default: 0.6, min: 0.25, max: 1.5, step: 0.05 },
      { key: 'height', label: 'Belt height (m)', type: 'number', default: 0.55, min: 0.2, max: 1.5, step: 0.05 },
      { key: 'speed', label: 'Speed (m/s)', type: 'number', default: 0.6, min: 0.05, max: 3, step: 0.05 },
    ],
    tagSlots: [
      { key: 'motor', label: 'Motor (run)', dataType: 'boolean', dir: 'read', hint: 'belt runs while true; unbound = always run' },
      { key: 'speed', label: 'Speed (0–100%)', dataType: 'number', dir: 'read', hint: 'scales belt speed; unbound = 100%' },
    ],
  },
  {
    kind: 'turntable',
    label: 'Turntable',
    description: 'Rotating disc: carousel when unbound, or a 0°↔angle indexing table on a tag.',
    params: [
      { key: 'diameter', label: 'Diameter (m)', type: 'number', default: 0.9, min: 0.4, max: 2.5, step: 0.05 },
      { key: 'height', label: 'Table height (m)', type: 'number', default: 0.55, min: 0.2, max: 1.5, step: 0.05 },
      { key: 'angle', label: 'Index angle (°)', type: 'number', default: 90, min: 15, max: 180, step: 15 },
      { key: 'speed', label: 'Speed (°/s)', type: 'number', default: 90, min: 10, max: 360, step: 10 },
    ],
    tagSlots: [
      { key: 'rotate', label: 'Rotate (cmd)', dataType: 'boolean', dir: 'read', hint: 'true → index angle, false → home; unbound = spin continuously' },
      { key: 'speed', label: 'Speed (0–100%)', dataType: 'number', dir: 'read', hint: 'scales rotation speed; unbound = 100%' },
      { key: 'atHome', label: 'Home switch → tag', dataType: 'boolean', dir: 'write', hint: 'true at 0° (optional)' },
      { key: 'atEnd', label: 'In-position switch → tag', dataType: 'boolean', dir: 'write', hint: 'true at the index angle (optional)' },
    ],
  },
  {
    kind: 'photoeye',
    label: 'Photo-eye sensor',
    description: 'Light beam between two posts; writes its tag while a part blocks the beam.',
    params: [
      { key: 'span', label: 'Beam span (m)', type: 'number', default: 0.9, min: 0.3, max: 3, step: 0.05 },
      { key: 'beamY', label: 'Beam height (m)', type: 'number', default: 0.66, min: 0.1, max: 2, step: 0.02 },
      { key: 'detect', label: 'Detect', type: 'choice', default: 'any', choices: ['any', 'color'] },
      { key: 'invert', label: 'Invert (true when clear)', type: 'boolean', default: false },
    ],
    tagSlots: [
      { key: 'output', label: 'Output → tag', dataType: 'boolean', dir: 'write', hint: 'a PLC input, e.g. tia.Eye (%I0.1)' },
    ],
  },
  {
    kind: 'pusher',
    label: 'Pusher cylinder',
    description: 'Pneumatic ram that shoves parts sideways when its tag goes true.',
    params: [
      { key: 'stroke', label: 'Stroke (m)', type: 'number', default: 0.55, min: 0.1, max: 2, step: 0.05 },
      { key: 'speed', label: 'Speed (m/s)', type: 'number', default: 1.4, min: 0.1, max: 4, step: 0.1 },
      { key: 'headY', label: 'Head height (m)', type: 'number', default: 0.66, min: 0.1, max: 2, step: 0.02 },
    ],
    tagSlots: [
      { key: 'extend', label: 'Extend (cmd)', dataType: 'boolean', dir: 'read', hint: 'a PLC output, e.g. tia.Push (%Q0.1)' },
      { key: 'atEnd', label: 'End switch → tag', dataType: 'boolean', dir: 'write', hint: 'true at full stroke (optional)' },
      { key: 'atHome', label: 'Home switch → tag', dataType: 'boolean', dir: 'write', hint: 'true when retracted (optional)' },
    ],
  },
  {
    kind: 'gate',
    label: 'Stop gate',
    description: 'Blade that pops up above the belt to hold parts; drops to release them.',
    params: [
      { key: 'width', label: 'Blade width (m)', type: 'number', default: 0.7, min: 0.2, max: 2, step: 0.05 },
      { key: 'topY', label: 'Belt surface (m)', type: 'number', default: 0.58, min: 0.2, max: 1.6, step: 0.02 },
      { key: 'invert', label: 'Invert (true = open)', type: 'boolean', default: false },
    ],
    tagSlots: [
      { key: 'raise', label: 'Raise (block)', dataType: 'boolean', dir: 'read', hint: 'blade up while true (or inverted)' },
    ],
  },
  {
    kind: 'bin',
    label: 'Collection bin',
    description: 'Catches parts; counts them in and can pulse a tag per part.',
    params: [
      { key: 'width', label: 'Width (m)', type: 'number', default: 0.75, min: 0.3, max: 2, step: 0.05 },
      { key: 'depth', label: 'Depth (m)', type: 'number', default: 0.75, min: 0.3, max: 2, step: 0.05 },
      { key: 'consume', label: 'Consume parts', type: 'boolean', default: true },
    ],
    tagSlots: [
      { key: 'pulse', label: 'Count pulse → tag', dataType: 'boolean', dir: 'write', hint: 'short true pulse per part (optional)' },
    ],
  },
  {
    kind: 'stacklight',
    label: 'Stack light (andon)',
    description: 'Red/amber/green signal tower; each lamp lights while its tag is true.',
    params: [
      { key: 'poleY', label: 'Pole height (m)', type: 'number', default: 1.5, min: 0.6, max: 3, step: 0.1 },
      { key: 'blink', label: 'Blink active lamps', type: 'boolean', default: false },
    ],
    tagSlots: [
      { key: 'red', label: 'Red lamp', dataType: 'boolean', dir: 'read', hint: 'fault / alarm' },
      { key: 'amber', label: 'Amber lamp', dataType: 'boolean', dir: 'read', hint: 'warning / attention' },
      { key: 'green', label: 'Green lamp', dataType: 'boolean', dir: 'read', hint: 'running / OK' },
    ],
  },
  {
    kind: 'spawner',
    label: 'Part dropper',
    description: 'Chute that drops parts — by button, on a timer, or on a tag edge.',
    params: [
      { key: 'dropY', label: 'Drop height (m)', type: 'number', default: 1.5, min: 0.4, max: 4, step: 0.1 },
      { key: 'intervalS', label: 'Auto every (s, 0=off)', type: 'number', default: 0, min: 0, max: 60, step: 0.5 },
      { key: 'shape', label: 'Part shape', type: 'choice', default: 'box', choices: ['box', 'cylinder', 'sphere', 'mixed'] },
      { key: 'size', label: 'Part size (m)', type: 'number', default: 0.24, min: 0.08, max: 0.6, step: 0.02 },
    ],
    tagSlots: [
      { key: 'trigger', label: 'Drop on rising edge', dataType: 'boolean', dir: 'read', hint: 'a PLC output, e.g. tia.Feed (%Q0.2)' },
    ],
  },
];

export function machineDef(kind: MachineKind): MachineDef {
  const def = MACHINE_CATALOG.find((d) => d.kind === kind);
  if (!def) throw new Error(`unknown machine kind: ${kind}`);
  return def;
}

/** Params merged over the catalog defaults, so old saves survive new params. */
export function paramsOf(m: MachineInstance): Record<string, MachineParamValue> {
  const out: Record<string, MachineParamValue> = {};
  for (const p of machineDef(m.kind).params) out[p.key] = m.params[p.key] ?? p.default;
  return out;
}

export function numParam(m: MachineInstance, key: string): number {
  const v = paramsOf(m)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export interface MachinePort {
  kind: 'in' | 'out';
  x: number;
  y: number;
  z: number;
  /** Flow direction at the port as a world yaw, degrees. */
  yawDeg: number;
}

/**
 * Flow connection points for chainable machines (conveyor/curve) — used by
 * arrange-mode snapping. World yaw convention: rotY 0 flows along +X; a
 * node's world +X = (cos β, 0, −sin β), so world yaw = local yaw + rotY.
 */
export function machinePorts(m: MachineInstance): MachinePort[] {
  const DEG = Math.PI / 180;
  const beta = m.rotY * DEG;
  const rot = (x: number, z: number) => ({
    x: m.x + x * Math.cos(beta) + z * Math.sin(beta),
    z: m.z - x * Math.sin(beta) + z * Math.cos(beta),
  });
  if (m.kind === 'conveyor') {
    const L = numParam(m, 'length');
    const h = numParam(m, 'height');
    const rise = numParam(m, 'rise');
    const a = rot(-L / 2, 0);
    const b = rot(L / 2, 0);
    return [
      { kind: 'in', x: a.x, y: h, z: a.z, yawDeg: m.rotY },
      { kind: 'out', x: b.x, y: h + rise, z: b.z, yawDeg: m.rotY },
    ];
  }
  if (m.kind === 'curve') {
    const R = numParam(m, 'radius');
    const raw = numParam(m, 'angleDeg') || 90;
    const s = raw >= 0 ? 1 : -1;
    const A = Math.min(Math.PI, Math.max(15 * DEG, Math.abs(raw) * DEG));
    const h = numParam(m, 'height');
    const entry = rot(0, 0);
    const exit = rot(R * Math.sin(A), s * R * (1 - Math.cos(A)));
    // local exit tangent (cos A, s·sin A) → local yaw −s·A
    return [
      { kind: 'in', x: entry.x, y: h, z: entry.z, yawDeg: m.rotY },
      { kind: 'out', x: exit.x, y: h, z: exit.z, yawDeg: m.rotY - s * (A / DEG) },
    ];
  }
  return [];
}

export function newMachine(kind: MachineKind, x: number, z: number, existing: MachineInstance[]): MachineInstance {
  const def = machineDef(kind);
  const params: Record<string, MachineParamValue> = {};
  for (const p of def.params) params[p.key] = p.default;
  let n = 1;
  while (existing.some((m) => m.name === `${def.label} ${n}`)) n++;
  return {
    id: `m-${crypto.randomUUID().slice(0, 8)}`,
    kind,
    name: `${def.label} ${n}`,
    x,
    z,
    rotY: 0,
    params,
    tags: {},
  };
}

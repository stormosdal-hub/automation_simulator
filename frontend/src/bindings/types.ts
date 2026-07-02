/** Everything that describes how live tags drive the 3D scene. */

export const BINDABLE_PROPERTIES = [
  'rotation.x',
  'rotation.y',
  'rotation.z',
  'position.x',
  'position.y',
  'position.z',
  'scaling.x',
  'scaling.y',
  'scaling.z',
  'material.emissive',
  'visible',
] as const;

export type BindingProperty = (typeof BINDABLE_PROPERTIES)[number];

/** Output values: numbers for transforms/rotation (degrees), '#rrggbb' strings for colors, booleans for visibility. */
export type TransformValue = number | boolean | string;

export type TransformSpec =
  | { kind: 'passthrough' }
  | { kind: 'linear'; inMin: number; inMax: number; outMin: number; outMax: number }
  | { kind: 'boolean'; whenTrue: TransformValue; whenFalse: TransformValue }
  | { kind: 'threshold'; stops: ThresholdStop[] };

/** Ordered stops; `upTo: null` is the final "else" bucket. */
export interface ThresholdStop {
  upTo: number | null;
  value: TransformValue;
}

export interface Binding {
  id: string;
  /** Scene node name (as imported from the GLB). */
  nodeId: string;
  property: BindingProperty;
  tagId: string;
  transform: TransformSpec;
}

export type WidgetType = 'switch' | 'button' | 'knob' | 'led' | 'gauge';

export interface WidgetConfig {
  min?: number;
  max?: number;
  onColor?: string;
  offColor?: string;
}

export interface Widget {
  id: string;
  type: WidgetType;
  label: string;
  tagId: string;
  config?: WidgetConfig;
}

export interface ControlPanelDef {
  id: string;
  title: string;
  widgets: Widget[];
}

export type AlarmCondition = 'gt' | 'lt' | 'true' | 'false';

export interface AlarmRule {
  id: string;
  tagId: string;
  condition: AlarmCondition;
  /** Required for gt/lt. */
  threshold?: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface Project {
  version: 1;
  name: string;
  modelUrl: string;
  bindings: Binding[];
  panels: ControlPanelDef[];
  alarms: AlarmRule[];
}

export function alarmActive(rule: AlarmRule, value: number | boolean | undefined): boolean {
  if (value === undefined) return false;
  switch (rule.condition) {
    case 'gt':
      return typeof value === 'number' && rule.threshold !== undefined && value > rule.threshold;
    case 'lt':
      return typeof value === 'number' && rule.threshold !== undefined && value < rule.threshold;
    case 'true':
      return value === true;
    case 'false':
      return value === false;
  }
}

/** Which tags a widget type may target (drives the editor's tag dropdown). */
export function widgetAcceptsTag(
  type: WidgetType,
  meta: { dataType: 'number' | 'boolean'; writable?: boolean },
): boolean {
  switch (type) {
    case 'switch':
    case 'button':
      return meta.dataType === 'boolean' && meta.writable === true;
    case 'knob':
      return meta.dataType === 'number' && meta.writable === true;
    case 'led':
      return meta.dataType === 'boolean';
    case 'gauge':
      return meta.dataType === 'number';
  }
}

export function applyTransform(
  spec: TransformSpec,
  value: number | boolean,
): TransformValue | null {
  switch (spec.kind) {
    case 'passthrough':
      return value;
    case 'linear': {
      if (typeof value !== 'number') return null;
      if (spec.inMax === spec.inMin) return spec.outMin;
      const t = (value - spec.inMin) / (spec.inMax - spec.inMin);
      const clamped = Math.max(0, Math.min(1, t));
      return spec.outMin + clamped * (spec.outMax - spec.outMin);
    }
    case 'boolean': {
      const b = typeof value === 'boolean' ? value : value > 0.5;
      return b ? spec.whenTrue : spec.whenFalse;
    }
    case 'threshold': {
      if (typeof value !== 'number') return null;
      for (const stop of spec.stops) {
        if (stop.upTo !== null && value <= stop.upTo) return stop.value;
      }
      const last = spec.stops[spec.stops.length - 1];
      return last && last.upTo === null ? last.value : null;
    }
  }
}

/** Which transform kinds make sense for a property (drives the editor dropdown). */
export function transformKindsFor(property: BindingProperty): TransformSpec['kind'][] {
  if (property === 'material.emissive') return ['boolean', 'threshold'];
  if (property === 'visible') return ['passthrough', 'boolean'];
  return ['passthrough', 'linear', 'boolean', 'threshold'];
}

export function defaultTransformFor(property: BindingProperty): TransformSpec {
  if (property === 'material.emissive') {
    return { kind: 'boolean', whenTrue: '#26f259', whenFalse: '#111111' };
  }
  return { kind: 'passthrough' };
}

export function defaultTransformOfKind(
  kind: TransformSpec['kind'],
  property: BindingProperty,
): TransformSpec {
  const isColor = property === 'material.emissive';
  const isBool = property === 'visible';
  switch (kind) {
    case 'passthrough':
      return { kind: 'passthrough' };
    case 'linear':
      return { kind: 'linear', inMin: 0, inMax: 100, outMin: 0, outMax: 1 };
    case 'boolean':
      if (isColor) return { kind: 'boolean', whenTrue: '#26f259', whenFalse: '#111111' };
      if (isBool) return { kind: 'boolean', whenTrue: true, whenFalse: false };
      return { kind: 'boolean', whenTrue: 1, whenFalse: 0 };
    case 'threshold':
      return isColor
        ? {
            kind: 'threshold',
            stops: [
              { upTo: 50, value: '#22cc55' },
              { upTo: null, value: '#e04444' },
            ],
          }
        : {
            kind: 'threshold',
            stops: [
              { upTo: 50, value: 0 },
              { upTo: null, value: 1 },
            ],
          };
  }
}

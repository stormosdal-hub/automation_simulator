import { AbstractMesh, Color3, Quaternion, Vector3 } from '@babylonjs/core';
import type { Scene, TransformNode } from '@babylonjs/core';
import type { TagStore } from '../tagStore';
import type { Binding } from './types';
import { applyTransform } from './types';

const DEG = Math.PI / 180;

type Applier = (value: number | boolean) => void;
type Axis = 'x' | 'y' | 'z';

/**
 * Applies the project's bindings to the scene every frame. Node lookups are
 * resolved once per rebuild; bindings whose target can't be resolved are
 * reported via getProblem() instead of failing silently.
 */
export class BindingEngine {
  private scene: Scene | null = null;
  private bindings: Binding[] = [];
  private appliers: { tagId: string; apply: Applier }[] = [];
  /** Shared per-node euler state so multiple rotation bindings on one node compose. */
  private eulerState = new Map<string, Vector3>();
  private problems = new Map<string, string>();
  /**
   * Original property values captured the first time a binding touches them;
   * restored when that binding is removed so nodes don't stay in their last
   * driven pose. Key: `<nodeId>|<property-group>`.
   */
  private baselines = new Map<string, () => void>();

  constructor(private store: TagStore) {}

  attach(scene: Scene): void {
    this.scene = scene;
    scene.onBeforeRenderObservable.add(() => this.tick());
    this.rebuild();
  }

  setBindings(bindings: Binding[]): void {
    this.bindings = bindings;
    this.rebuild();
  }

  getProblem(bindingId: string): string | null {
    return this.problems.get(bindingId) ?? null;
  }

  private tick(): void {
    for (const { tagId, apply } of this.appliers) {
      const value = this.store.raw(tagId);
      if (value !== undefined) apply(value);
    }
  }

  private rebuild(): void {
    this.appliers = [];
    this.problems.clear();
    this.eulerState.clear();
    if (!this.scene) return;
    // release baselines whose binding disappeared — restores the original value
    const activeKeys = new Set(this.bindings.map((b) => baselineKey(b.nodeId, b.property)));
    for (const [key, restore] of this.baselines) {
      if (!activeKeys.has(key)) {
        restore();
        this.baselines.delete(key);
      }
    }
    for (const binding of this.bindings) {
      const result = this.buildApplier(this.scene, binding);
      if (typeof result === 'string') this.problems.set(binding.id, result);
      else this.appliers.push({ tagId: binding.tagId, apply: result });
    }
  }

  private captureBaseline(key: string, restore: () => void): void {
    if (!this.baselines.has(key)) this.baselines.set(key, restore);
  }

  private buildApplier(scene: Scene, b: Binding): Applier | string {
    const node =
      scene.getMeshByName(b.nodeId) ?? (scene.getTransformNodeByName(b.nodeId) as TransformNode | null);
    if (!node) return `node '${b.nodeId}' not found in scene`;

    const [group, axisRaw] = b.property.split('.');
    const axis = axisRaw as Axis | undefined;

    if (group === 'rotation' && axis) {
      const baseQuat = node.rotationQuaternion ? node.rotationQuaternion.clone() : null;
      const baseEuler = node.rotation.clone();
      this.captureBaseline(baselineKey(b.nodeId, b.property), () => {
        node.rotationQuaternion = baseQuat ? baseQuat.clone() : null;
        node.rotation.copyFrom(baseEuler);
      });
      let euler = this.eulerState.get(b.nodeId);
      if (!euler) {
        euler = node.rotationQuaternion
          ? node.rotationQuaternion.toEulerAngles()
          : node.rotation.clone();
        this.eulerState.set(b.nodeId, euler);
      }
      const state = euler;
      return (v) => {
        const out = applyTransform(b.transform, v);
        if (typeof out !== 'number') return;
        state[axis] = out * DEG;
        node.rotationQuaternion = Quaternion.FromEulerVector(state);
      };
    }

    if (group === 'position' && axis) {
      const base = node.position[axis];
      this.captureBaseline(baselineKey(b.nodeId, b.property), () => {
        node.position[axis] = base;
      });
      return (v) => {
        const out = applyTransform(b.transform, v);
        if (typeof out === 'number') node.position[axis] = out;
      };
    }

    if (group === 'scaling' && axis) {
      const base = node.scaling[axis];
      this.captureBaseline(baselineKey(b.nodeId, b.property), () => {
        node.scaling[axis] = base;
      });
      return (v) => {
        const out = applyTransform(b.transform, v);
        if (typeof out === 'number') node.scaling[axis] = out;
      };
    }

    if (b.property === 'material.emissive') {
      if (!(node instanceof AbstractMesh)) {
        return `'${b.nodeId}' is a transform node — pick a mesh with a material`;
      }
      const material = node.material;
      if (!material || !('emissiveColor' in material)) {
        return `'${b.nodeId}' has no material with an emissive color`;
      }
      const mat = material as { emissiveColor: Color3 };
      const baseColor = mat.emissiveColor.clone();
      this.captureBaseline(baselineKey(b.nodeId, b.property), () => {
        mat.emissiveColor = baseColor.clone();
      });
      return (v) => {
        const out = applyTransform(b.transform, v);
        if (typeof out === 'string') mat.emissiveColor = Color3.FromHexString(out);
      };
    }

    if (b.property === 'visible') {
      const baseEnabled = node.isEnabled();
      this.captureBaseline(baselineKey(b.nodeId, b.property), () => {
        node.setEnabled(baseEnabled);
      });
      return (v) => {
        const out = applyTransform(b.transform, v);
        if (typeof out === 'boolean') node.setEnabled(out);
      };
    }

    return `unsupported property '${b.property}'`;
  }
}

/** Rotation axes share one baseline (whole-node quaternion); others are per-property. */
function baselineKey(nodeId: string, property: string): string {
  return property.startsWith('rotation.') ? `${nodeId}|rotation` : `${nodeId}|${property}`;
}

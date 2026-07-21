import {
  Color3,
  PositionGizmo,
  RotationGizmo,
  UtilityLayerRenderer,
} from '@babylonjs/core';
import type { Scene, TransformNode } from '@babylonjs/core';
import type { MachineInstance } from './types';
import { machinePorts } from './types';

export type GizmoMode = 'move' | 'rotate' | null;

interface Deps {
  /** Current machine list, for conveyor-chain snapping while dragging. */
  machines(): MachineInstance[];
  /** Called with the machine's final x/z/rotY once a drag ends. */
  commit(machineId: string, patch: { x?: number; z?: number; rotY?: number }): void;
}

/**
 * Move/rotate a single machine with an on-screen 3D gizmo instead of the
 * Machines panel's numeric fields or the global Arrange-mode drag. Machines
 * only ever translate on the ground plane and yaw around Y, so both gizmos
 * are pared down to just that: PositionGizmo keeps only its XZ-plane square
 * (Babylon names plane gizmos by their normal axis, so that's `yPlaneGizmo`)
 * and RotationGizmo keeps only its Y ring — every other axis/plane handle is
 * disabled so there's nothing on screen that would produce an invalid pose
 * (machines don't move vertically or tilt).
 *
 * Reuses the same conveyor-chain snap (`machinePorts`) as the Arrange-mode
 * drag so dragging a belt by its gizmo still clicks into a neighboring belt's
 * port, live during the drag — not just on release.
 */
export class MachineGizmos {
  private utilLayer: UtilityLayerRenderer;
  private posGizmo: PositionGizmo;
  private rotGizmo: RotationGizmo;
  private mode: GizmoMode = null;
  private machineId: string | null = null;

  constructor(
    scene: Scene,
    private deps: Deps,
  ) {
    this.utilLayer = new UtilityLayerRenderer(scene);
    this.utilLayer.utilityLayerScene.autoClearDepthAndStencil = false;

    this.posGizmo = new PositionGizmo(this.utilLayer);
    this.posGizmo.xGizmo.isEnabled = false;
    this.posGizmo.yGizmo.isEnabled = false;
    this.posGizmo.zGizmo.isEnabled = false;
    this.posGizmo.xPlaneGizmo.isEnabled = false;
    this.posGizmo.zPlaneGizmo.isEnabled = false;
    this.posGizmo.yPlaneGizmo.isEnabled = true; // the XZ (ground) plane square
    this.posGizmo.yPlaneGizmo.coloredMaterial.diffuseColor = Color3.FromHexString('#3d8bff');
    this.posGizmo.updateGizmoRotationToMatchAttachedMesh = false; // plane stays flat regardless of yaw
    this.posGizmo.attachedNode = null;

    this.rotGizmo = new RotationGizmo(this.utilLayer);
    this.rotGizmo.xGizmo.isEnabled = false;
    this.rotGizmo.zGizmo.isEnabled = false;
    this.rotGizmo.yGizmo.isEnabled = true;
    this.rotGizmo.yGizmo.coloredMaterial.diffuseColor = Color3.FromHexString('#3d8bff');
    this.rotGizmo.attachedNode = null;

    this.posGizmo.onDragEndObservable.add(() => this.commitMove());
    this.rotGizmo.onDragEndObservable.add(() => this.commitRotate());
  }

  /** Start moving `machineId` via the ground-plane gizmo. */
  startMove(machineId: string, root: TransformNode): void {
    this.detach();
    this.mode = 'move';
    this.machineId = machineId;
    this.posGizmo.attachedNode = root;
  }

  /** Start rotating `machineId` (yaw only) via the ring gizmo. */
  startRotate(machineId: string, root: TransformNode): void {
    this.detach();
    this.mode = 'rotate';
    this.machineId = machineId;
    this.rotGizmo.attachedNode = root;
  }

  detach(): void {
    this.posGizmo.attachedNode = null;
    this.rotGizmo.attachedNode = null;
    this.mode = null;
    this.machineId = null;
  }

  get activeMode(): GizmoMode {
    return this.mode;
  }

  get activeMachineId(): string | null {
    return this.machineId;
  }

  private commitMove(): void {
    const root = this.posGizmo.attachedNode as TransformNode | null;
    const id = this.machineId;
    if (!root || !id) return;
    const def = this.deps.machines().find((m) => m.id === id);
    let x = Math.round(root.position.x * 100) / 100;
    let z = Math.round(root.position.z * 100) / 100;
    let rotY = def?.rotY ?? 0;
    const snap = def && this.trySnap({ ...def, x, z });
    if (snap) ({ x, z, rotY } = snap);
    // detach BEFORE the commit: upsertMachine triggers sync(), which disposes
    // this rig's TransformNode and builds a fresh one — the gizmo must not
    // stay attached to a node that's about to be destroyed.
    this.detach();
    this.deps.commit(id, { x, z, rotY });
  }

  private commitRotate(): void {
    const root = this.rotGizmo.attachedNode as TransformNode | null;
    const id = this.machineId;
    if (!root || !id) return;
    const rotYRad = ((root.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const rotY = Math.round(((rotYRad * 180) / Math.PI) * 10) / 10;
    this.detach();
    this.deps.commit(id, { rotY });
  }

  /** Same conveyor end-snap heuristic as Arrange-mode drag (engine.ts). */
  private trySnap(t: MachineInstance): { x: number; z: number; rotY: number } | null {
    const myPorts = machinePorts(t);
    if (!myPorts.length) return null;
    const SNAP = 0.35;
    const norm = (deg: number) => ((deg % 360) + 360) % 360;
    let best: { d: number; x: number; z: number; rotY: number } | null = null;
    for (const other of this.deps.machines()) {
      if (other.id === t.id) continue;
      for (const op of machinePorts(other)) {
        for (const mp of myPorts) {
          if (mp.kind === op.kind) continue;
          if (Math.abs(mp.y - op.y) > 0.12) continue;
          const d = Math.hypot(mp.x - op.x, mp.z - op.z);
          if (d > SNAP || (best && d >= best.d)) continue;
          const rotY = norm(t.rotY + (op.yawDeg - mp.yawDeg));
          const rp = machinePorts({ ...t, rotY, x: 0, z: 0 }).find((q) => q.kind === mp.kind);
          if (!rp) continue;
          best = { d, x: op.x - rp.x, z: op.z - rp.z, rotY };
        }
      }
    }
    if (!best) return null;
    return {
      x: Math.round(best.x * 100) / 100,
      z: Math.round(best.z * 100) / 100,
      rotY: Math.round(best.rotY * 10) / 10,
    };
  }

  dispose(): void {
    this.posGizmo.dispose();
    this.rotGizmo.dispose();
    this.utilLayer.dispose();
  }
}

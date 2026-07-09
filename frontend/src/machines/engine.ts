import { PointerEventTypes, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Camera, Scene } from '@babylonjs/core';
import type { GatewayConnection } from '../wsClient';
import type { ProjectStore } from '../projectStore';
import type { TagStore } from '../tagStore';
import { BoxManager, type PartShape } from './boxes';
import { FluidNet } from './fluids';
import { initScenePhysics, physicsReady } from './physics';
import { buildRig, type MachineIO, type Rig } from './rigs';
import { machinePorts, type MachineInstance } from './types';

/**
 * Runs the placed machine library: builds a Rig per `project.machines` entry
 * (diffed by JSON so unrelated project edits don't rebuild anything), ticks
 * them every frame, owns the dropped parts, and handles viewport gestures —
 * Shift+click drops a part; in arrange mode machines drag on the ground plane.
 */
export class MachineEngine {
  arrangeMode = false;
  private scene: Scene | null = null;
  private boxes: BoxManager | null = null;
  private entries = new Map<string, { json: string; rig: Rig }>();
  private io: EngineIO;
  private drag: { id: string; offX: number; offZ: number } | null = null;
  /** A part being dragged by the mouse; released with its momentum (throw). */
  private grab: { name: string; target: Vector3 } | null = null;
  private grabVel = new Vector3();
  /**
   * Runtime-only manual overrides per machine (the relay-test-button / PLC
   * force analog): consulted by rigs before tag bindings. Keyed by machine id
   * so a param-edit rebuild keeps the override; removal clears it. Never saved.
   */
  private manual = new Map<string, Record<string, boolean | number>>();
  /** Shared tank-volume network for the process machines. */
  readonly fluids = new FluidNet();

  constructor(
    private store: TagStore,
    conn: GatewayConnection,
    private projectStore: ProjectStore,
  ) {
    this.io = new EngineIO(store, conn);
  }

  async attach(scene: Scene): Promise<void> {
    this.scene = scene;
    await initScenePhysics(scene);
    this.boxes = new BoxManager(scene);
    this.sync();
    this.projectStore.onChange(() => this.sync());

    let last = performance.now();
    scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000); // clamp background-tab jumps
      last = now;
      this.io.maybeFlush(now);
      this.steerGrab(scene);
      for (const e of this.entries.values()) e.rig.tick(dt, now);
      this.boxes?.cull();
    });

    scene.onPointerObservable.add((info) => {
      const ev = info.event as PointerEvent;
      if (info.type === PointerEventTypes.POINTERDOWN) {
        if (ev.shiftKey) {
          const p = this.groundPoint(scene);
          if (p) this.dropAt(p.x, p.y + 1.1, p.z);
          return;
        }
        const picked = info.pickInfo?.pickedMesh ?? null;
        if (picked?.name.startsWith('part:')) {
          this.beginGrab(scene, picked.name);
          return;
        }
        if (this.arrangeMode) this.beginDrag(scene, picked);
      } else if (info.type === PointerEventTypes.POINTERMOVE) {
        if (this.grab) this.moveGrab(scene);
        else if (this.drag) this.moveDrag(scene);
      } else if (info.type === PointerEventTypes.POINTERUP) {
        if (this.grab) this.endGrab(scene);
        if (this.drag) this.endDrag(scene);
      }
    });
  }

  // ------------------------------------------------------------ lifecycle

  private machines(): MachineInstance[] {
    return this.projectStore.project.machines ?? [];
  }

  /** Rebuild only machines whose serialized definition changed. */
  private sync(): void {
    const scene = this.scene;
    const boxes = this.boxes;
    if (!scene || !boxes) return;
    const want = new Map(this.machines().map((m) => [m.id, m] as const));
    for (const [id, e] of this.entries) {
      const m = want.get(id);
      if (!m || JSON.stringify(m) !== e.json) {
        e.rig.dispose();
        this.entries.delete(id);
        if (!m) {
          this.manual.delete(id); // machine removed → drop its overrides
          this.fluids.unregister(id); // …and its water (rebuilds keep both)
        }
      }
    }
    for (const [id, m] of want) {
      if (this.entries.has(id)) continue;
      try {
        const rig = buildRig(m, { scene, io: this.io, boxes, fluids: this.fluids, manual: (mid) => this.manualState(mid) });
        this.entries.set(id, { json: JSON.stringify(m), rig });
      } catch (err) {
        console.error(`[machines] failed to build '${m.name}':`, err);
      }
    }
  }

  // ------------------------------------------------------------ gestures

  /** Where the pointer ray meets the scene (or the y=0 plane as fallback). */
  private groundPoint(scene: Scene): Vector3 | null {
    const pick = scene.pick(scene.pointerX, scene.pointerY);
    if (pick?.pickedPoint) return pick.pickedPoint;
    return this.rayPlaneY(scene, 0);
  }

  /** Pointer ray ∩ the horizontal plane at `y` (never picks meshes — a grabbed part can't self-target). */
  private rayPlaneY(scene: Scene, y: number): Vector3 | null {
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, scene.activeCamera);
    if (Math.abs(ray.direction.y) < 1e-6) return null;
    const t = (y - ray.origin.y) / ray.direction.y;
    return t > 0 ? ray.origin.add(ray.direction.scale(t)) : null;
  }

  // ---- part grab & throw

  private beginGrab(scene: Scene, name: string): void {
    const part = this.boxes?.parts.find((p) => p.mesh.name === name && !p.dead);
    if (!part) return;
    const target = part.mesh.position.clone();
    target.y = Math.max(0.45, target.y); // lift a little so parts pull out of bins
    this.grab = { name, target };
    scene.activeCamera?.detachControl();
  }

  private moveGrab(scene: Scene): void {
    if (!this.grab) return;
    const p = this.rayPlaneY(scene, this.grab.target.y);
    if (p) this.grab.target.set(p.x, this.grab.target.y, p.z);
  }

  /** Spring-steer the grabbed part toward the cursor each frame (dynamic body → throws stay physical). */
  private steerGrab(scene: Scene): void {
    const grab = this.grab;
    if (!grab) return;
    const part = this.boxes?.parts.find((p) => p.mesh.name === grab.name && !p.dead);
    if (!part) {
      // consumed/culled mid-drag
      this.grab = null;
      this.reattachCamera(scene);
      return;
    }
    grab.target.subtractToRef(part.mesh.position, this.grabVel);
    this.grabVel.scaleInPlace(10);
    const len = this.grabVel.length();
    if (len > 8) this.grabVel.scaleInPlace(8 / len);
    part.agg.body.setLinearVelocity(this.grabVel);
  }

  private endGrab(scene: Scene): void {
    const grab = this.grab;
    this.grab = null;
    this.reattachCamera(scene);
    if (!grab) return;
    const part = this.boxes?.parts.find((p) => p.mesh.name === grab.name && !p.dead);
    if (!part) return;
    // release with capped momentum — a flick throws it
    part.agg.body.getLinearVelocityToRef(this.grabVel);
    const len = this.grabVel.length();
    if (len > 6) {
      this.grabVel.scaleInPlace(6 / len);
      part.agg.body.setLinearVelocity(this.grabVel);
    }
  }

  private machineIdFrom(mesh: AbstractMesh | null): string | null {
    let node: { name: string; parent: unknown } | null = mesh;
    while (node) {
      if (node.name.startsWith('machine:')) return node.name.split(':')[1] ?? null;
      node = node.parent as { name: string; parent: unknown } | null;
    }
    return null;
  }

  private beginDrag(scene: Scene, mesh: AbstractMesh | null): void {
    const id = this.machineIdFrom(mesh);
    if (!id) return;
    const m = this.machines().find((x) => x.id === id);
    const p = this.groundPoint(scene);
    if (!m || !p) return;
    this.drag = { id, offX: m.x - p.x, offZ: m.z - p.z };
    scene.activeCamera?.detachControl();
  }

  private moveDrag(scene: Scene): void {
    if (!this.drag) return;
    const p = this.groundPoint(scene);
    const root = scene.getTransformNodeByName(`machine:${this.drag.id}`);
    const def = this.machines().find((x) => x.id === this.drag?.id);
    if (!p || !root || !def) return;
    let x = p.x + this.drag.offX;
    let z = p.z + this.drag.offZ;
    let rotY = def.rotY;
    const snap = this.trySnap({ ...def, x, z });
    if (snap) ({ x, z, rotY } = snap);
    root.position.x = x;
    root.position.z = z;
    root.rotation.y = rotY * (Math.PI / 180);
  }

  /**
   * Conveyor chaining: if one of the dragged machine's flow ports (entry/exit)
   * is near a counterpart port on another machine, rotate so the flow
   * directions align and translate so the ports coincide.
   */
  private trySnap(t: MachineInstance): { x: number; z: number; rotY: number } | null {
    const myPorts = machinePorts(t);
    if (!myPorts.length) return null;
    const SNAP = 0.35;
    const norm = (deg: number) => ((deg % 360) + 360) % 360;
    let best: { d: number; x: number; z: number; rotY: number } | null = null;
    for (const other of this.machines()) {
      if (other.id === t.id) continue;
      for (const op of machinePorts(other)) {
        for (const mp of myPorts) {
          if (mp.kind === op.kind) continue; // in ↔ out only
          if (Math.abs(mp.y - op.y) > 0.12) continue; // belt heights must match
          const d = Math.hypot(mp.x - op.x, mp.z - op.z);
          if (d > SNAP || (best && d >= best.d)) continue;
          const rotY = norm(t.rotY + (op.yawDeg - mp.yawDeg));
          // the same port's offset from the machine origin at the new rotation
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

  private endDrag(scene: Scene): void {
    const drag = this.drag;
    this.drag = null;
    this.reattachCamera(scene);
    if (!drag) return;
    const root = scene.getTransformNodeByName(`machine:${drag.id}`);
    const m = this.machines().find((x) => x.id === drag.id);
    if (!root || !m) return;
    const x = Math.round(root.position.x * 100) / 100;
    const z = Math.round(root.position.z * 100) / 100;
    const rotY = Math.round(((((root.rotation.y * 180) / Math.PI) % 360) + 360) % 360 * 10) / 10;
    // commit (incl. a snapped rotation) → sync() rebuilds this machine there,
    // placing its physics bodies too
    this.projectStore.upsertMachine({ ...m, x, z, rotY });
  }

  private reattachCamera(scene: Scene): void {
    const camera = scene.activeCamera as (Camera & { attachControl(el?: unknown, noPreventDefault?: boolean): void }) | null;
    camera?.attachControl(scene.getEngine().getRenderingCanvas(), true);
  }

  // ------------------------------------------------------------ public API

  physicsReady(): boolean {
    return physicsReady();
  }

  dropAt(x: number, y: number, z: number, shape: PartShape = 'box', size = 0.24): boolean {
    return this.boxes?.drop(x, y, z, shape, size) ?? false;
  }

  /** Drop a part from a spawner (its "Drop now" button). */
  manualDrop(machineId: string): void {
    this.entries.get(machineId)?.rig.manualDrop?.();
  }

  clearParts(): void {
    this.boxes?.clear();
  }

  partCount(): number {
    return this.boxes?.parts.length ?? 0;
  }

  problemFor(machineId: string): string | null {
    return this.entries.get(machineId)?.rig.problem() ?? null;
  }

  statusFor(machineId: string): string | null {
    return this.entries.get(machineId)?.rig.status?.() ?? null;
  }

  // ---- manual overrides (runtime-only "relay test buttons")

  manualState(machineId: string): Record<string, boolean | number> {
    return this.manual.get(machineId) ?? {};
  }

  /** Set one override key; `undefined` returns that key to Auto. */
  setManual(machineId: string, key: string, value: boolean | number | undefined): void {
    const cur = { ...this.manualState(machineId) };
    if (value === undefined) delete cur[key];
    else cur[key] = value;
    if (Object.keys(cur).length) this.manual.set(machineId, cur);
    else this.manual.delete(machineId);
  }

  hasManual(machineId: string): boolean {
    return this.manual.has(machineId);
  }

  /** Run a rig's named panel action (e.g. the bin's 'reset'). */
  runAction(machineId: string, name: string): void {
    this.entries.get(machineId)?.rig.action?.(name);
  }

  /** Testing hook (window.__SIM__.machineEngine.debug()). */
  debug(): {
    physics: boolean;
    machines: string[];
    manual: string[];
    parts: { name: string; x: number; y: number; z: number; colored: boolean }[];
  } {
    return {
      physics: physicsReady(),
      machines: [...this.entries.keys()],
      manual: [...this.manual.keys()],
      parts: (this.boxes?.parts ?? []).map((p) => ({
        name: p.mesh.name,
        x: Math.round(p.mesh.position.x * 1000) / 1000,
        y: Math.round(p.mesh.position.y * 1000) / 1000,
        z: Math.round(p.mesh.position.z * 1000) / 1000,
        colored: p.colored,
      })),
    };
  }
}

/**
 * Tag IO for rigs. Reads come straight from the TagStore; writes are
 * change-deduped so sensors ticking at 60 fps send one message per edge.
 * The dedupe cache clears every 2 s, so state re-asserts itself after a
 * runtime restart / reconnect without hammering anything.
 */
class EngineIO implements MachineIO {
  private lastSent = new Map<string, boolean>();
  private lastSentNum = new Map<string, number>();
  private lastFlush = 0;

  constructor(
    private store: TagStore,
    private conn: GatewayConnection,
  ) {}

  maybeFlush(now: number): void {
    if (now - this.lastFlush > 2000) {
      this.lastFlush = now;
      this.lastSent.clear();
      this.lastSentNum.clear();
    }
  }

  readBool(tagId: string | undefined): boolean | null {
    if (!tagId) return null;
    const v = this.store.raw(tagId);
    return typeof v === 'boolean' ? v : null;
  }

  readNum(tagId: string | undefined): number | null {
    if (!tagId) return null;
    const v = this.store.raw(tagId);
    return typeof v === 'number' ? v : null;
  }

  writeBool(tagId: string | undefined, value: boolean): void {
    if (!tagId) return;
    const meta = this.store.metaFor(tagId);
    if (!meta || meta.dataType !== 'boolean' || meta.writable !== true) return;
    if (this.lastSent.get(tagId) === value) return;
    this.lastSent.set(tagId, value);
    this.conn.write(tagId, value);
  }

  writeNum(tagId: string | undefined, value: number): void {
    if (!tagId || !Number.isFinite(value)) return;
    const meta = this.store.metaFor(tagId);
    if (!meta || meta.dataType !== 'number' || meta.writable !== true) return;
    const q = Math.round(value * 10) / 10; // quantize so a creeping level isn't 60 msgs/s
    if (this.lastSentNum.get(tagId) === q) return;
    this.lastSentNum.set(tagId, q);
    this.conn.write(tagId, q);
  }

  tagProblem(tagId: string | undefined, dataType: 'number' | 'boolean', dir: 'read' | 'write'): string | null {
    if (!tagId) return null;
    const meta = this.store.metaFor(tagId);
    if (!meta) return `tag '${tagId}' not found`;
    if (meta.dataType !== dataType) return `tag '${tagId}' is not ${dataType}`;
    if (dir === 'write' && meta.writable !== true) return `tag '${tagId}' is not writable`;
    return null;
  }
}

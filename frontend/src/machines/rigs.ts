import {
  Color3,
  DynamicTexture,
  Matrix,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { Mesh, PhysicsAggregate, Scene } from '@babylonjs/core';
import type { BoxManager, BoxPart, PartShape } from './boxes';
import { animatedBody, physicsReady, staticBody } from './physics';
import { numParam, paramsOf, type MachineInstance } from './types';

/** Tag IO handed to rigs by the engine: change-deduped writes, typed reads. */
export interface MachineIO {
  readBool(tagId: string | undefined): boolean | null;
  readNum(tagId: string | undefined): number | null;
  writeBool(tagId: string | undefined, value: boolean): void;
  /** null when the binding is usable (or unbound); else a human-readable issue. */
  tagProblem(tagId: string | undefined, dataType: 'number' | 'boolean', dir: 'read' | 'write'): string | null;
}

export interface RigDeps {
  scene: Scene;
  io: MachineIO;
  boxes: BoxManager;
  /**
   * Runtime-only manual overrides for a machine (the relay-test-button /
   * PLC-force analog). Keys are checked BEFORE tag bindings; an absent key
   * means Auto. Not persisted; survives rig rebuilds (keyed by machine id).
   */
  manual(machineId: string): Record<string, boolean | number>;
}

/** A machine instance living in the scene: meshes + physics + behavior. */
export interface Rig {
  root: TransformNode;
  tick(dt: number, now: number): void;
  dispose(): void;
  problem(): string | null;
  /** Live one-liner for the panel (e.g. a bin's count). */
  status?(): string | null;
  /** Spawner's "Drop now". */
  manualDrop?(): void;
  /** Named panel actions (e.g. the bin's 'reset'). */
  action?(name: string): void;
}

const DEG = Math.PI / 180;
const tmpV = new Vector3();
const tmpInv = new Matrix();

function mat(scene: Scene, name: string, hex: string, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.1, 0.1, 0.1);
  if (alpha < 1) m.alpha = alpha;
  return m;
}

function box(
  scene: Scene,
  root: TransformNode,
  name: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: StandardMaterial,
): Mesh {
  const m = MeshBuilder.CreateBox(`${root.name}:${name}`, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  m.parent = root;
  m.material = material;
  return m;
}

function newRoot(m: MachineInstance, scene: Scene): TransformNode {
  const root = new TransformNode(`machine:${m.id}`, scene);
  root.position.set(m.x, 0, m.z);
  root.rotation.y = m.rotY * DEG;
  return root;
}

/** World direction of the machine's local +X (its flow axis). */
function flowDir(root: TransformNode, out: Vector3): Vector3 {
  const wm = root.getWorldMatrix();
  out.set(wm.m[0]!, wm.m[1]!, wm.m[2]!);
  return out.normalize();
}

const BELT_ACCEL = 8; // m/s² a belt can impose on a part
const tmpVel = new Vector3();
const tmpV2 = new Vector3();

/**
 * Belt transport: blend the part's velocity component along `dir` toward
 * `beltV`. Velocity writes (not impulses — those lose to the static belt
 * collider's friction) also move a deactivated part, so a restarted belt
 * picks sleepers back up. Belt colliders stay LOW friction; braking is the
 * same blend with beltV = 0.
 */
function blendAlong(part: BoxPart, dir: Vector3, beltV: number, dt: number): void {
  part.agg.body.getLinearVelocityToRef(tmpVel);
  const along = Vector3.Dot(tmpVel, dir);
  const delta = Math.max(-BELT_ACCEL * dt, Math.min(BELT_ACCEL * dt, beltV - along));
  if (Math.abs(delta) > 1e-3) {
    dir.scaleToRef(delta, tmpV2);
    tmpVel.addInPlace(tmpV2);
    part.agg.body.setLinearVelocity(tmpVel);
  }
}

/** The shared dark slat texture that scrolls to sell belt motion. */
function beltTexture(scene: Scene, name: string, uScale: number): { mat: StandardMaterial; tex: DynamicTexture } {
  const beltMat = mat(scene, `${name}:beltm`, '#1d2127');
  const tex = new DynamicTexture(`${name}:tex`, { width: 128, height: 128 }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = '#23282f';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#2f3641';
  for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 22, 128);
  tex.update();
  tex.uScale = Math.max(1, Math.round(uScale));
  beltMat.diffuseTexture = tex;
  return { mat: beltMat, tex };
}

// ---------------------------------------------------------------- conveyor

function conveyorRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io, boxes } = deps;
  const length = numParam(m, 'length');
  const width = numParam(m, 'width');
  const height = numParam(m, 'height');
  const rise = Math.max(-0.8 * length, Math.min(0.8 * length, numParam(m, 'rise')));
  const maxSpeed = numParam(m, 'speed');
  const rails = String(paramsOf(m)['rails'] ?? 'both');

  const root = newRoot(m, scene);
  // belt/rails/rollers live under a pitched frame (incline via `rise`); the
  // frame origin is the TOP SURFACE center so frame-local y = height above belt
  const frame = new TransformNode(`${root.name}:frame`, scene);
  frame.parent = root;
  frame.position.set(0, height + rise / 2, 0);
  frame.rotation.z = Math.asin(rise / length); // +X end higher for positive rise

  const frameMat = mat(scene, `${root.name}:framem`, '#3a4654');
  const railMat = mat(scene, `${root.name}:rail`, '#c9a13b');
  const { mat: beltMat, tex } = beltTexture(scene, root.name, length / 0.35);

  const mk = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: StandardMaterial) => {
    const mesh = box(scene, root, name, w, h, d, x, y, z, material);
    mesh.parent = frame;
    return mesh;
  };
  const belt = mk('belt', length, 0.1, width, 0, -0.05, 0, beltMat);
  const railMeshes: Mesh[] = [];
  if (rails === 'both' || rails === 'left') railMeshes.push(mk('railL', length, 0.1, 0.04, 0, 0.05, -(width / 2 + 0.02), railMat));
  if (rails === 'both' || rails === 'right') railMeshes.push(mk('railR', length, 0.1, 0.04, 0, 0.05, width / 2 + 0.02, railMat));
  for (const ex of [-1, 1] as const) {
    const roller = MeshBuilder.CreateCylinder(`${root.name}:roller${ex}`, { diameter: 0.12, height: width, tessellation: 16 }, scene);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(ex * (length / 2), -0.06, 0);
    roller.parent = frame;
    roller.material = frameMat;
  }
  // legs stay vertical under the root; each end matches its belt height
  for (const [ex, ez] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    const h = Math.max(0.06, height + (ex > 0 ? rise : 0) - 0.1);
    box(scene, root, `leg${ex}${ez}`, 0.07, h, 0.07, ex * (length / 2 - 0.12), h / 2, ez * (width / 2 - 0.06), frameMat);
  }

  const aggs: PhysicsAggregate[] = [];
  if (physicsReady()) {
    aggs.push(staticBody(belt, 0.15)); // low friction: blendAlong is the transport
    for (const r of railMeshes) aggs.push(staticBody(r, 0.15));
  }

  const dir = new Vector3();
  // manual override → tag → default (run at 100 %)
  const motorOn = () => {
    const o = deps.manual(m.id)['motor'];
    if (typeof o === 'boolean') return o;
    return m.tags.motor ? (io.readBool(m.tags.motor) ?? false) : true;
  };
  const speedPct = () => {
    const o = deps.manual(m.id)['speed'];
    if (typeof o === 'number') return o;
    return m.tags.speed ? (io.readNum(m.tags.speed) ?? 0) : 100;
  };

  return {
    root,
    tick(dt) {
      const frac = Math.max(0, Math.min(1, speedPct() / 100));
      const beltV = motorOn() ? maxSpeed * frac : 0;
      if (beltV > 0) tex.uOffset = (tex.uOffset + (beltV * dt) / 0.35) % 1;
      if (!physicsReady()) return;
      frame.getWorldMatrix().invertToRef(tmpInv);
      flowDir(frame, dir); // includes the pitch — drive runs along the slope
      for (const part of boxes.parts) {
        if (part.dead) continue;
        Vector3.TransformCoordinatesToRef(part.mesh.position, tmpInv, tmpV);
        if (Math.abs(tmpV.x) > length / 2 + 0.03) continue;
        if (Math.abs(tmpV.z) > width / 2 + 0.02) continue;
        const gap = tmpV.y - part.halfY;
        if (gap < -0.06 || gap > 0.08) continue;
        blendAlong(part, dir, beltV, dt);
      }
    },
    dispose() {
      for (const a of aggs) a.dispose();
      tex.dispose();
      root.dispose(false, true);
    },
    problem() {
      return (
        io.tagProblem(m.tags.motor, 'boolean', 'read') ??
        io.tagProblem(m.tags.speed, 'number', 'read') ??
        (physicsReady() ? null : 'physics unavailable — parts disabled')
      );
    },
    status() {
      return motorOn() ? 'running' : 'stopped';
    },
  };
}

// ---------------------------------------------------------------- curved conveyor

function curveRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io, boxes } = deps;
  const R = numParam(m, 'radius');
  const rawAngle = numParam(m, 'angleDeg') || 90;
  const s = rawAngle >= 0 ? 1 : -1; // turn direction
  const A = Math.min(Math.PI, Math.max(15 * DEG, Math.abs(rawAngle) * DEG));
  const width = numParam(m, 'width');
  const height = numParam(m, 'height');
  const maxSpeed = numParam(m, 'speed');

  const root = newRoot(m, scene);
  const frameMat = mat(scene, `${root.name}:framem`, '#3a4654');
  const railMat = mat(scene, `${root.name}:rail`, '#c9a13b');

  // arc: entry at the local origin heading +X, center at (0, ·, s·R);
  // point on radius r at angle t: C + r·(sin t, 0, −s·cos t)
  const cz = s * R;
  const at = (r: number, t: number) => ({ x: r * Math.sin(t), z: cz - s * r * Math.cos(t) });

  const N = Math.max(2, Math.ceil(A / (15 * DEG)));
  const dTh = A / N;
  const { mat: beltMat, tex } = beltTexture(scene, root.name, (R * dTh) / 0.35);

  const aggs: PhysicsAggregate[] = [];
  const statics: Mesh[] = [];
  for (let i = 0; i < N; i++) {
    const th = (i + 0.5) * dTh;
    const p = at(R, th);
    const seg = box(scene, root, `belt${i}`, R * dTh * 1.06, 0.1, width, p.x, height - 0.05, p.z, beltMat);
    seg.rotation.y = -s * th;
    statics.push(seg);
    for (const [r, tag] of [[R - (width / 2 + 0.04), 'I'], [R + (width / 2 + 0.04), 'O']] as const) {
      const q = at(r, th);
      const rail = box(scene, root, `rail${tag}${i}`, r * dTh * 1.06, 0.1, 0.04, q.x, height + 0.05, q.z, railMat);
      rail.rotation.y = -s * th;
      statics.push(rail);
    }
  }
  for (const t of [0.25, 0.75]) {
    const p = at(R, t * A);
    box(scene, root, `leg${t * 100}`, 0.07, height - 0.1, 0.07, p.x, (height - 0.1) / 2, p.z, frameMat);
  }
  if (physicsReady()) for (const mesh of statics) aggs.push(staticBody(mesh, 0.15));

  const dir = new Vector3();
  const tangent = new Vector3();
  const motorOn = () => {
    const o = deps.manual(m.id)['motor'];
    if (typeof o === 'boolean') return o;
    return m.tags.motor ? (io.readBool(m.tags.motor) ?? false) : true;
  };
  const speedPct = () => {
    const o = deps.manual(m.id)['speed'];
    if (typeof o === 'number') return o;
    return m.tags.speed ? (io.readNum(m.tags.speed) ?? 0) : 100;
  };

  return {
    root,
    tick(dt) {
      const frac = Math.max(0, Math.min(1, speedPct() / 100));
      const beltV = motorOn() ? maxSpeed * frac : 0;
      if (beltV > 0) tex.uOffset = (tex.uOffset + (beltV * dt) / 0.35) % 1;
      if (!physicsReady()) return;
      const wm = root.getWorldMatrix();
      wm.invertToRef(tmpInv);
      for (const part of boxes.parts) {
        if (part.dead) continue;
        Vector3.TransformCoordinatesToRef(part.mesh.position, tmpInv, tmpV);
        const dx = tmpV.x;
        const dz = tmpV.z - cz;
        const r = Math.hypot(dx, dz);
        if (Math.abs(r - R) > width / 2 + 0.02) continue;
        const gap = tmpV.y - part.halfY - height;
        if (gap < -0.06 || gap > 0.08) continue;
        const th = Math.atan2(dx, -s * dz); // from C + r·(sin t, ·, −s·cos t)
        if (th < -0.06 || th > A + 0.06) continue;
        // drive along the tangent at the part's own arc position
        tangent.set(Math.cos(th), 0, s * Math.sin(th));
        Vector3.TransformNormalToRef(tangent, wm, dir);
        dir.normalize();
        blendAlong(part, dir, beltV, dt);
      }
    },
    dispose() {
      for (const a of aggs) a.dispose();
      tex.dispose();
      root.dispose(false, true);
    },
    problem() {
      return (
        io.tagProblem(m.tags.motor, 'boolean', 'read') ??
        io.tagProblem(m.tags.speed, 'number', 'read') ??
        (physicsReady() ? null : 'physics unavailable — parts disabled')
      );
    },
    status() {
      return motorOn() ? 'running' : 'stopped';
    },
  };
}

// ---------------------------------------------------------------- turntable

function turntableRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io, boxes } = deps;
  const diameter = numParam(m, 'diameter');
  const height = numParam(m, 'height');
  const angle = numParam(m, 'angle');
  const speed = numParam(m, 'speed'); // deg/s

  const root = newRoot(m, scene);
  const frameMat = mat(scene, `${root.name}:framem`, '#3a4654');
  const discMat = mat(scene, `${root.name}:discm`, '#252b33');
  const markMat = mat(scene, `${root.name}:markm`, '#17bda0');

  const pedestal = MeshBuilder.CreateCylinder(`${root.name}:pedestal`, { diameter: 0.34, height: height - 0.06, tessellation: 20 }, scene);
  pedestal.position.set(0, (height - 0.06) / 2, 0);
  pedestal.parent = root;
  pedestal.material = frameMat;
  const disc = MeshBuilder.CreateCylinder(`${root.name}:disc`, { diameter, height: 0.08, tessellation: 36 }, scene);
  disc.position.set(0, height - 0.04, 0);
  disc.parent = root;
  disc.material = discMat;
  // rotation marker: a flow stripe across the disc top (rotates with it)
  const stripe = box(scene, root, 'stripe', diameter * 0.9, 0.012, 0.07, 0, 0.046, 0, markMat);
  stripe.parent = disc;

  const aggs: PhysicsAggregate[] = [];
  if (physicsReady()) aggs.push(animatedBody(disc, 0.15, 'cylinder'));

  let theta = 0; // deg
  const angVel = new Vector3();
  // manual override → tag → carousel (null)
  const rotateCmd = (): boolean | null => {
    const o = deps.manual(m.id)['rotate'];
    if (typeof o === 'boolean') return o;
    return m.tags.rotate ? (io.readBool(m.tags.rotate) ?? false) : null;
  };
  const speedNow = () => {
    const o = deps.manual(m.id)['speed'];
    const pct = typeof o === 'number' ? o : m.tags.speed ? (io.readNum(m.tags.speed) ?? 0) : 100;
    return speed * Math.max(0, Math.min(1, pct / 100));
  };

  return {
    root,
    tick(dt) {
      const cmd = rotateCmd();
      const spd = speedNow();
      let omegaDeg: number;
      if (cmd === null) {
        omegaDeg = spd;
        theta = (theta + spd * dt) % 360;
      } else {
        const target = cmd ? angle : 0;
        const step = Math.max(-spd * dt, Math.min(spd * dt, target - theta));
        theta += step;
        omegaDeg = dt > 0 ? step / dt : 0;
      }
      disc.rotation.y = theta * DEG;
      io.writeBool(m.tags.atHome, cmd !== null && Math.abs(theta) < 1);
      io.writeBool(m.tags.atEnd, cmd !== null && Math.abs(theta - angle) < 1);
      if (!physicsReady()) return;
      const omega = omegaDeg * DEG; // rad/s, = d(rotation.y)/dt
      if (Math.abs(omega) < 0.01) return; // parked disc is just a platform
      // carry parts: a point at world offset (dx,dz) from the axis, riding a
      // node whose rotation.y grows at ω, moves at ω·(dz, −dx). Kinematic
      // friction alone barely does this (same story as belt/pusher).
      const c = root.getAbsolutePosition();
      for (const part of boxes.parts) {
        if (part.dead) continue;
        const dx = part.mesh.position.x - c.x;
        const dz = part.mesh.position.z - c.z;
        if (dx * dx + dz * dz > (diameter / 2 + 0.03) ** 2) continue;
        const gap = part.mesh.position.y - part.halfY - height;
        if (gap < -0.06 || gap > 0.08) continue;
        part.agg.body.getLinearVelocityToRef(tmpVel);
        const wantX = omega * dz;
        const wantZ = -omega * dx;
        let ddx = wantX - tmpVel.x;
        let ddz = wantZ - tmpVel.z;
        const mag = Math.hypot(ddx, ddz);
        const cap = BELT_ACCEL * dt;
        if (mag > cap) {
          ddx *= cap / mag;
          ddz *= cap / mag;
        }
        if (mag > 1e-3) {
          tmpVel.x += ddx;
          tmpVel.z += ddz;
          part.agg.body.setLinearVelocity(tmpVel);
        }
        angVel.set(0, omega, 0);
        part.agg.body.setAngularVelocity(angVel); // parts turn with the table
      }
    },
    dispose() {
      for (const a of aggs) a.dispose();
      root.dispose(false, true);
    },
    problem() {
      return (
        io.tagProblem(m.tags.rotate, 'boolean', 'read') ??
        io.tagProblem(m.tags.speed, 'number', 'read') ??
        io.tagProblem(m.tags.atHome, 'boolean', 'write') ??
        io.tagProblem(m.tags.atEnd, 'boolean', 'write') ??
        (physicsReady() ? null : 'physics unavailable — parts disabled')
      );
    },
    status() {
      if (rotateCmd() === null) return 'spinning';
      return `${Math.round(theta)}°`;
    },
  };
}

// ---------------------------------------------------------------- stack light

function stacklightRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io } = deps;
  const poleY = numParam(m, 'poleY');
  const blink = paramsOf(m)['blink'] === true;

  const root = newRoot(m, scene);
  const frameMat = mat(scene, `${root.name}:framem`, '#2c3540');
  box(scene, root, 'base', 0.16, 0.06, 0.16, 0, 0.03, 0, frameMat);
  const pole = MeshBuilder.CreateCylinder(`${root.name}:pole`, { diameter: 0.035, height: poleY, tessellation: 10 }, scene);
  pole.position.set(0, poleY / 2, 0);
  pole.parent = root;
  pole.material = frameMat;

  const TIERS = [
    { key: 'green', on: '#2fd06a', off: '#0e2a18' },
    { key: 'amber', on: '#f2b13a', off: '#2c2410' },
    { key: 'red', on: '#ff4d4d', off: '#2e1010' },
  ] as const;
  const lampMats: StandardMaterial[] = [];
  TIERS.forEach((t, i) => {
    const lm = mat(scene, `${root.name}:${t.key}m`, t.off);
    lampMats.push(lm);
    const seg = MeshBuilder.CreateCylinder(`${root.name}:${t.key}`, { diameter: 0.12, height: 0.11, tessellation: 16 }, scene);
    seg.position.set(0, poleY + 0.06 + i * 0.115, 0);
    seg.parent = root;
    seg.material = lm;
  });
  const cap = MeshBuilder.CreateCylinder(`${root.name}:cap`, { diameter: 0.13, height: 0.03, tessellation: 16 }, scene);
  cap.position.set(0, poleY + 0.06 + TIERS.length * 0.115 + 0.01, 0);
  cap.parent = root;
  cap.material = frameMat;

  const lit = [false, false, false];

  return {
    root,
    tick(_dt, now) {
      const test = deps.manual(m.id)['test']; // lamp test: solid on/off, bypasses tags + blink
      const phase = blink ? Math.floor(now / 500) % 2 === 0 : true; // 1 Hz blink
      TIERS.forEach((t, i) => {
        const on = typeof test === 'boolean' ? test : (io.readBool(m.tags[t.key]) ?? false) && phase;
        if (on === lit[i]) return;
        lit[i] = on;
        const lm = lampMats[i]!;
        lm.diffuseColor = Color3.FromHexString(on ? t.on : t.off);
        lm.emissiveColor = on ? Color3.FromHexString(t.on).scale(0.85) : Color3.Black();
      });
    },
    dispose() {
      root.dispose(false, true);
    },
    problem() {
      if (!m.tags['red'] && !m.tags['amber'] && !m.tags['green']) return 'no lamp tags bound';
      return (
        io.tagProblem(m.tags['red'], 'boolean', 'read') ??
        io.tagProblem(m.tags['amber'], 'boolean', 'read') ??
        io.tagProblem(m.tags['green'], 'boolean', 'read')
      );
    },
    status() {
      const on = TIERS.filter((t) => io.readBool(m.tags[t.key]) === true).map((t) => t.key);
      return on.length ? on.join('+') : 'off';
    },
  };
}

// ---------------------------------------------------------------- photo-eye

function photoeyeRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io, boxes } = deps;
  const span = numParam(m, 'span');
  const beamY = numParam(m, 'beamY');
  const invert = paramsOf(m)['invert'] === true;
  const colorOnly = paramsOf(m)['detect'] === 'color'; // a vision sensor: sees accent-colored parts only
  const idleHex = colorOnly ? '#a86ee8' : '#17bda0';

  const root = newRoot(m, scene);
  const postMat = mat(scene, `${root.name}:post`, '#2c3540');
  const headMat = mat(scene, `${root.name}:head`, '#c9a13b');
  const beamMat = mat(scene, `${root.name}:beam`, idleHex, 0.35);
  beamMat.emissiveColor = Color3.FromHexString(idleHex);

  for (const ez of [-1, 1] as const) {
    box(scene, root, `post${ez}`, 0.06, beamY + 0.14, 0.06, 0, (beamY + 0.14) / 2, ez * (span / 2), postMat);
    box(scene, root, `head${ez}`, 0.08, 0.08, 0.06, 0, beamY, ez * (span / 2 - 0.05), headMat);
  }
  const beam = box(scene, root, 'ray', 0.025, 0.025, span - 0.14, 0, beamY, 0, beamMat);
  beam.isPickable = false;

  const p0 = new Vector3();
  const p1 = new Vector3();
  const seg = new Vector3();
  let blocked = false;

  return {
    root,
    tick() {
      const wm = root.getWorldMatrix();
      Vector3.TransformCoordinatesFromFloatsToRef(0, beamY, -span / 2, wm, p0);
      Vector3.TransformCoordinatesFromFloatsToRef(0, beamY, span / 2, wm, p1);
      p1.subtractToRef(p0, seg);
      const segLen2 = seg.lengthSquared();
      const forced = deps.manual(m.id)['blocked']; // force the sensor, no part needed
      let hit = false;
      if (typeof forced === 'boolean') {
        hit = forced;
      } else {
        for (const part of boxes.parts) {
          if (part.dead) continue;
          if (colorOnly && !part.colored) continue;
          part.mesh.position.subtractToRef(p0, tmpV);
          const t = segLen2 > 0 ? Math.max(0, Math.min(1, Vector3.Dot(tmpV, seg) / segLen2)) : 0;
          const dx = tmpV.x - seg.x * t;
          const dy = tmpV.y - seg.y * t;
          const dz = tmpV.z - seg.z * t;
          if (dx * dx + dy * dy + dz * dz < part.radius * part.radius) {
            hit = true;
            break;
          }
        }
      }
      if (hit !== blocked) {
        blocked = hit;
        const c = blocked ? '#ff4d4d' : idleHex;
        beamMat.emissiveColor = Color3.FromHexString(c);
        beamMat.diffuseColor = beamMat.emissiveColor;
        beamMat.alpha = blocked ? 0.85 : 0.35;
      }
      io.writeBool(m.tags.output, invert ? !blocked : blocked);
    },
    dispose() {
      root.dispose(false, true);
    },
    problem() {
      if (!m.tags.output) return 'no output tag bound';
      return io.tagProblem(m.tags.output, 'boolean', 'write');
    },
    status() {
      return blocked ? 'blocked' : 'clear';
    },
  };
}

// ---------------------------------------------------------------- pusher

function pusherRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io } = deps;
  const stroke = numParam(m, 'stroke');
  const speed = numParam(m, 'speed');
  const headY = numParam(m, 'headY');

  const root = newRoot(m, scene);
  const bodyMat = mat(scene, `${root.name}:body`, '#3a4654');
  const headMat = mat(scene, `${root.name}:headm`, '#c94f3d');
  const rodMat = mat(scene, `${root.name}:rod`, '#9aa7b5');

  box(scene, root, 'pedestal', 0.14, headY - 0.15, 0.14, -0.2, (headY - 0.15) / 2, 0, bodyMat);
  const housing = box(scene, root, 'housing', 0.36, 0.3, 0.34, -0.2, headY, 0, bodyMat);
  const rod = box(scene, root, 'ram', 0.14, 0.05, 0.05, 0.05, headY, 0, rodMat);
  const head = box(scene, root, 'head', 0.06, 0.34, 0.56, 0.12, headY, 0, headMat);

  const aggs: PhysicsAggregate[] = [];
  if (physicsReady()) {
    aggs.push(staticBody(housing, 0.4), animatedBody(head, 0.25));
  }

  let ext = 0;
  const dir = new Vector3();

  return {
    root,
    tick(dt) {
      const o = deps.manual(m.id)['extend'];
      const cmd = typeof o === 'boolean' ? o : m.tags.extend ? (io.readBool(m.tags.extend) ?? false) : false;
      const target = cmd ? stroke : 0;
      const extending = target > ext;
      ext += Math.max(-speed * dt, Math.min(speed * dt, target - ext));
      head.position.x = 0.12 + ext;
      rod.scaling.x = (ext + 0.14) / 0.14;
      rod.position.x = -0.02 + (ext + 0.14) / 2;
      io.writeBool(m.tags.atEnd, ext >= stroke - 0.01);
      io.writeBool(m.tags.atHome, ext <= 0.01);
      // while extending, hand parts at the face the ram's velocity — the
      // ANIMATED body alone displaces them but barely transfers momentum,
      // so they'd topple off a belt edge instead of being launched clear
      if (extending && physicsReady()) {
        root.getWorldMatrix().invertToRef(tmpInv);
        flowDir(root, dir);
        const face = 0.12 + ext + 0.03;
        for (const part of deps.boxes.parts) {
          if (part.dead) continue;
          Vector3.TransformCoordinatesToRef(part.mesh.position, tmpInv, tmpV);
          if (Math.abs(tmpV.x - face) > part.radius + 0.12) continue;
          if (Math.abs(tmpV.z) > 0.28 + part.radius) continue;
          if (Math.abs(tmpV.y - headY) > 0.17 + part.halfY) continue;
          part.agg.body.getLinearVelocityToRef(tmpVel);
          const along = Vector3.Dot(tmpVel, dir);
          if (along < speed) {
            dir.scaleToRef(speed - along, tmpV2);
            tmpVel.addInPlace(tmpV2);
            part.agg.body.setLinearVelocity(tmpVel);
          }
        }
      }
    },
    dispose() {
      for (const a of aggs) a.dispose();
      root.dispose(false, true);
    },
    problem() {
      if (!m.tags.extend) return 'no extend tag bound';
      return (
        io.tagProblem(m.tags.extend, 'boolean', 'read') ??
        io.tagProblem(m.tags.atEnd, 'boolean', 'write') ??
        io.tagProblem(m.tags.atHome, 'boolean', 'write') ??
        (physicsReady() ? null : 'physics unavailable')
      );
    },
    status() {
      return ext >= stroke - 0.01 ? 'extended' : ext <= 0.01 ? 'home' : 'moving';
    },
  };
}

// ---------------------------------------------------------------- stop gate

function gateRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io } = deps;
  const width = numParam(m, 'width');
  const topY = numParam(m, 'topY');
  const invert = paramsOf(m)['invert'] === true;
  const raisedY = topY + 0.11;
  const loweredY = topY - 0.3;

  const root = newRoot(m, scene);
  const postMat = mat(scene, `${root.name}:post`, '#2c3540');
  const bladeMat = mat(scene, `${root.name}:blade`, '#c9a13b');

  const postH = topY + 0.38;
  for (const ez of [-1, 1] as const) {
    box(scene, root, `post${ez}`, 0.07, postH, 0.07, 0, postH / 2, ez * (width / 2 + 0.07), postMat);
  }
  box(scene, root, 'bar', 0.07, 0.07, width + 0.2, 0, postH, 0, postMat);
  const blade = box(scene, root, 'blade', 0.06, 0.34, width, 0, raisedY, 0, bladeMat);

  const aggs: PhysicsAggregate[] = [];
  if (physicsReady()) aggs.push(animatedBody(blade, 0.1));

  return {
    root,
    tick(dt) {
      const o = deps.manual(m.id)['raise'];
      const cmd = typeof o === 'boolean' ? o : m.tags.raise ? (io.readBool(m.tags.raise) ?? false) : true;
      const up = invert ? !cmd : cmd;
      const target = up ? raisedY : loweredY;
      blade.position.y += Math.max(-1.6 * dt, Math.min(1.6 * dt, target - blade.position.y));
    },
    dispose() {
      for (const a of aggs) a.dispose();
      root.dispose(false, true);
    },
    problem() {
      return io.tagProblem(m.tags.raise, 'boolean', 'read') ?? (physicsReady() ? null : 'physics unavailable');
    },
    status() {
      return blade.position.y > (raisedY + loweredY) / 2 ? 'blocking' : 'open';
    },
  };
}

// ---------------------------------------------------------------- bin

function binRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io, boxes } = deps;
  const width = numParam(m, 'width');
  const depth = numParam(m, 'depth');
  const consume = paramsOf(m)['consume'] !== false;
  const wallH = 0.5;

  const root = newRoot(m, scene);
  const wallMat = mat(scene, `${root.name}:wall`, '#46525f', 0.92);

  const floor = box(scene, root, 'floor', width + 0.1, 0.05, depth + 0.1, 0, 0.03, 0, wallMat);
  const w1 = box(scene, root, 'wx0', 0.04, wallH, depth + 0.1, -(width / 2 + 0.03), wallH / 2, 0, wallMat);
  const w2 = box(scene, root, 'wx1', 0.04, wallH, depth + 0.1, width / 2 + 0.03, wallH / 2, 0, wallMat);
  const w3 = box(scene, root, 'wz0', width + 0.1, wallH, 0.04, 0, wallH / 2, -(depth / 2 + 0.03), wallMat);
  const w4 = box(scene, root, 'wz1', width + 0.1, wallH, 0.04, 0, wallH / 2, depth / 2 + 0.03, wallMat);

  // count label
  const tex = new DynamicTexture(`${root.name}:count`, { width: 128, height: 64 }, scene, false);
  const labelMat = new StandardMaterial(`${root.name}:labelm`, scene);
  labelMat.diffuseTexture = tex;
  labelMat.emissiveColor = new Color3(0.9, 0.9, 0.9);
  labelMat.backFaceCulling = false;
  const label = MeshBuilder.CreatePlane(`${root.name}:label`, { width: 0.42, height: 0.21 }, scene);
  label.position.set(0, wallH + 0.16, 0);
  label.parent = root;
  label.material = labelMat;
  label.billboardMode = TransformNode.BILLBOARDMODE_ALL; // always face the camera

  const aggs: PhysicsAggregate[] = [];
  if (physicsReady()) for (const w of [floor, w1, w2, w3, w4]) aggs.push(staticBody(w, 0.6));

  let count = 0;
  let pulseUntil = 0;
  const drawCount = () => {
    // x=null centers the text; the clear color repaints the background
    tex.drawText(String(count), null, 46, 'bold 40px monospace', '#17bda0', '#0d1319', true);
  };
  drawCount();

  return {
    root,
    tick(_dt, now) {
      root.getWorldMatrix().invertToRef(tmpInv);
      for (const part of boxes.parts) {
        if (part.dead || part.countedBy.has(m.id)) continue;
        Vector3.TransformCoordinatesToRef(part.mesh.position, tmpInv, tmpV);
        if (Math.abs(tmpV.x) < width / 2 - 0.02 && Math.abs(tmpV.z) < depth / 2 - 0.02 && tmpV.y > 0 && tmpV.y < wallH) {
          part.countedBy.add(m.id);
          count++;
          pulseUntil = now + 250;
          drawCount();
          if (consume) boxes.consume(part);
        }
      }
      io.writeBool(m.tags.pulse, now < pulseUntil);
    },
    dispose() {
      for (const a of aggs) a.dispose();
      tex.dispose();
      root.dispose(false, true);
    },
    problem() {
      return io.tagProblem(m.tags.pulse, 'boolean', 'write');
    },
    status() {
      return `in: ${count}`;
    },
    action(name) {
      if (name === 'reset') {
        count = 0;
        pulseUntil = 0;
        drawCount();
      }
    },
  };
}

// ---------------------------------------------------------------- spawner

function spawnerRig(m: MachineInstance, deps: RigDeps): Rig {
  const { scene, io, boxes } = deps;
  const dropY = numParam(m, 'dropY');
  const intervalS = numParam(m, 'intervalS');
  const size = numParam(m, 'size');
  const shapeParam = String(paramsOf(m)['shape'] ?? 'box');

  const root = newRoot(m, scene);
  const frameMat = mat(scene, `${root.name}:frame`, '#3a4654');
  const chuteMat = mat(scene, `${root.name}:chute`, '#17bda0', 0.85);

  // stance wide enough to straddle a default-width conveyor's guard rails
  const legH = dropY + 0.18;
  for (const [ex, ez] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    box(scene, root, `leg${ex}${ez}`, 0.05, legH, 0.05, ex * 0.38, legH / 2, ez * 0.38, frameMat);
  }
  // open chute mouth
  box(scene, root, 'cx0', 0.04, 0.26, 0.64, -0.32, dropY + 0.2, 0, chuteMat);
  box(scene, root, 'cx1', 0.04, 0.26, 0.64, 0.32, dropY + 0.2, 0, chuteMat);
  box(scene, root, 'cz0', 0.64, 0.26, 0.04, 0, dropY + 0.2, -0.32, chuteMat);
  box(scene, root, 'cz1', 0.64, 0.26, 0.04, 0, dropY + 0.2, 0.32, chuteMat);

  let acc = 0;
  let prevTrig = false;
  const doDrop = () => {
    const shape: PartShape =
      shapeParam === 'mixed'
        ? (['box', 'cylinder', 'sphere'] as const)[Math.floor(Math.random() * 3)]!
        : shapeParam === 'cylinder' || shapeParam === 'sphere'
          ? shapeParam
          : 'box';
    const wp = root.getAbsolutePosition();
    const j = () => (Math.random() - 0.5) * 0.08;
    boxes.drop(wp.x + j(), dropY, wp.z + j(), shape, size);
  };

  return {
    root,
    tick(dt) {
      if (intervalS > 0) {
        acc += dt;
        if (acc >= intervalS) {
          acc = 0;
          doDrop();
        }
      }
      const trig = io.readBool(m.tags.trigger) ?? false;
      if (trig && !prevTrig) doDrop();
      prevTrig = trig;
    },
    dispose() {
      root.dispose(false, true);
    },
    problem() {
      return (
        io.tagProblem(m.tags.trigger, 'boolean', 'read') ??
        (physicsReady() ? null : 'physics unavailable — cannot drop parts')
      );
    },
    manualDrop: doDrop,
  };
}

// ---------------------------------------------------------------- factory

export function buildRig(m: MachineInstance, deps: RigDeps): Rig {
  switch (m.kind) {
    case 'conveyor':
      return conveyorRig(m, deps);
    case 'curve':
      return curveRig(m, deps);
    case 'turntable':
      return turntableRig(m, deps);
    case 'stacklight':
      return stacklightRig(m, deps);
    case 'photoeye':
      return photoeyeRig(m, deps);
    case 'pusher':
      return pusherRig(m, deps);
    case 'gate':
      return gateRig(m, deps);
    case 'bin':
      return binRig(m, deps);
    case 'spawner':
      return spawnerRig(m, deps);
  }
}

import { Color3, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { Mesh, PhysicsAggregate, Scene } from '@babylonjs/core';
import { dynamicBody, physicsReady } from './physics';

export type PartShape = 'box' | 'cylinder' | 'sphere';

/** One droppable part (box/can/ball) living in the physics world. */
export interface BoxPart {
  mesh: Mesh;
  agg: PhysicsAggregate;
  mass: number;
  /** Half height — used for the on-the-belt contact test. */
  halfY: number;
  /** Bounding radius — used for the photo-eye beam test. */
  radius: number;
  /** Bin ids that already counted this part. */
  countedBy: Set<string>;
  /** Accent-colored part (vs plain cardboard) — what a 'color' photo-eye sees. */
  colored: boolean;
  bornAt: number;
  dead: boolean;
}

const MAX_PARTS = 60;
// indices 0-3 are plain cardboard, 4+ are the accent colors
const PALETTE = ['#b08850', '#a37e4a', '#bd935c', '#9e7743', '#3d6ea5', '#a54040', '#3f8a5a'];
const FIRST_COLORED = 4;

/** Owns every dropped part: spawn, cap, cull-when-fallen, consume. */
export class BoxManager {
  parts: BoxPart[] = [];
  private nextId = 1;
  private mats: StandardMaterial[] = [];

  constructor(private scene: Scene) {}

  private material(i: number): StandardMaterial {
    if (!this.mats.length) {
      this.mats = PALETTE.map((hex, n) => {
        const m = new StandardMaterial(`part-mat-${n}`, this.scene);
        m.diffuseColor = Color3.FromHexString(hex);
        m.specularColor = new Color3(0.08, 0.08, 0.08);
        return m;
      });
    }
    return this.mats[i % this.mats.length]!;
  }

  /** Spawn a part at a world position. Returns false when physics is unavailable. */
  drop(x: number, y: number, z: number, shape: PartShape = 'box', size = 0.24): boolean {
    if (!physicsReady()) return false;
    const n = this.nextId++;
    let mesh: Mesh;
    let halfY: number;
    let volume: number;
    if (shape === 'sphere') {
      mesh = MeshBuilder.CreateSphere(`part:${n}`, { diameter: size, segments: 12 }, this.scene);
      halfY = size / 2;
      volume = (Math.PI / 6) * size ** 3;
    } else if (shape === 'cylinder') {
      const h = size * 1.05;
      mesh = MeshBuilder.CreateCylinder(`part:${n}`, { diameter: size, height: h, tessellation: 20 }, this.scene);
      halfY = h / 2;
      volume = Math.PI * (size / 2) ** 2 * h;
    } else {
      const h = size * 0.72;
      mesh = MeshBuilder.CreateBox(`part:${n}`, { width: size, height: h, depth: size * 0.9 }, this.scene);
      halfY = h / 2;
      volume = size * h * size * 0.9;
    }
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.random() * Math.PI;
    const matIdx = Math.floor(Math.random() * PALETTE.length);
    mesh.material = this.material(matIdx);
    const mass = Math.max(0.4, 250 * volume); // parcel-ish density
    const agg = dynamicBody(mesh, shape, mass);
    agg.body.setAngularDamping(0.6); // corner landings shouldn't kick parts off the belt
    this.parts.push({
      mesh,
      agg,
      mass,
      halfY,
      radius: size * 0.68,
      countedBy: new Set(),
      colored: matIdx >= FIRST_COLORED,
      bornAt: performance.now(),
      dead: false,
    });
    // over the cap: retire the oldest
    for (let i = 0; i < this.parts.length - MAX_PARTS; i++) this.parts[i]!.dead = true;
    return true;
  }

  /** Mark a part for removal (a bin swallowed it). */
  consume(part: BoxPart): void {
    part.dead = true;
  }

  /** Dispose dead parts and anything that fell off the world. Call once per frame. */
  cull(): void {
    let changed = false;
    for (const p of this.parts) {
      if (p.dead || p.mesh.position.y < -4) {
        p.agg.dispose();
        p.mesh.dispose();
        p.dead = true;
        changed = true;
      }
    }
    if (changed) this.parts = this.parts.filter((p) => !p.dead);
  }

  clear(): void {
    for (const p of this.parts) p.dead = true;
    this.cull();
  }
}

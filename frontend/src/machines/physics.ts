import {
  HavokPlugin,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsMotionType,
  PhysicsShapeType,
  Vector3,
} from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';

/**
 * Physics world for the machine library (Havok, WASM). Loading can fail
 * (blocked WASM, exotic browser) — machines then still render and can be
 * arranged; only parts/boxes are disabled. Callers check `physicsReady()`.
 */

let ready = false;

export function physicsReady(): boolean {
  return ready;
}

export async function initScenePhysics(scene: Scene): Promise<boolean> {
  try {
    const havok = await HavokPhysics();
    scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havok));
    // invisible slab under the visual ground plane (a zero-thickness plane
    // would make a degenerate box collider)
    const slab = MeshBuilder.CreateBox('ground-collider', { width: 14, height: 0.2, depth: 14 }, scene);
    slab.position.y = -0.1;
    slab.isVisible = false;
    slab.isPickable = false;
    staticBody(slab, 0.9);
    ready = true;
  } catch (err) {
    console.warn('[machines] physics unavailable:', err);
    ready = false;
  }
  return ready;
}

/** Immovable collider (frames, belts, walls). Call after the mesh's world transform is final. */
export function staticBody(mesh: Mesh, friction = 0.7, shape: 'box' | 'cylinder' = 'box'): PhysicsAggregate {
  mesh.computeWorldMatrix(true);
  const type = shape === 'cylinder' ? PhysicsShapeType.CYLINDER : PhysicsShapeType.BOX;
  return new PhysicsAggregate(mesh, type, { mass: 0, friction, restitution: 0.02 }, mesh.getScene());
}

/** Kinematic collider that follows the mesh when we move it (pusher head, gate blade, turntable disc). */
export function animatedBody(mesh: Mesh, friction = 0.5, shape: 'box' | 'cylinder' = 'box'): PhysicsAggregate {
  const agg = staticBody(mesh, friction, shape);
  agg.body.setMotionType(PhysicsMotionType.ANIMATED);
  agg.body.disablePreStep = false; // physics re-reads the node transform every step
  return agg;
}

/** Free-falling part. */
export function dynamicBody(
  mesh: Mesh,
  shape: 'box' | 'cylinder' | 'sphere',
  mass: number,
): PhysicsAggregate {
  mesh.computeWorldMatrix(true);
  const type =
    shape === 'sphere' ? PhysicsShapeType.SPHERE : shape === 'cylinder' ? PhysicsShapeType.CYLINDER : PhysicsShapeType.BOX;
  return new PhysicsAggregate(mesh, type, { mass, friction: 0.6, restitution: 0.05 }, mesh.getScene());
}

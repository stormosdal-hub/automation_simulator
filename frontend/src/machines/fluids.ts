/**
 * Lumped-parameter fluid network for the process machines (tanks, pumps,
 * valves). No particles — each tank is a volume integrated per tick
 * (dV/dt = ΣQin − ΣQout), which gives the clean first-order dynamics a PID
 * loop wants. Volumes in LITERS, geometry in meters.
 */

export interface TankInfo {
  areaM2: number;
  heightM: number;
  capacityL: number;
  volumeL: number;
  x: number;
  z: number;
}

/** Endpoint ids are tank machine ids, or the pseudo-endpoints below. */
export const SUPPLY = 'supply'; // mains: infinite source at constant head
export const DRAIN = 'drain'; // sewer: infinite sink at zero head
const SUPPLY_HEAD_M = 1.5;

export class FluidNet {
  private tanks = new Map<string, TankInfo>();

  /** Register/refresh a tank. Re-registering (rig rebuild / drag) KEEPS its water. */
  register(id: string, areaM2: number, heightM: number, initPct: number, x: number, z: number): void {
    const capacityL = areaM2 * heightM * 1000;
    const prev = this.tanks.get(id);
    const volumeL = prev ? Math.min(prev.volumeL, capacityL) : capacityL * Math.max(0, Math.min(100, initPct)) / 100;
    this.tanks.set(id, { areaM2, heightM, capacityL, volumeL, x, z });
  }

  unregister(id: string): void {
    this.tanks.delete(id);
  }

  get(id: string): TankInfo | undefined {
    return this.tanks.get(id);
  }

  has(id: string): boolean {
    return id === SUPPLY || id === DRAIN || this.tanks.has(id);
  }

  levelPct(id: string): number {
    const t = this.tanks.get(id);
    return t ? (t.volumeL / t.capacityL) * 100 : 0;
  }

  /** Fluid surface height above ground — the head that drives gravity valves. */
  surfaceM(id: string): number {
    if (id === SUPPLY) return SUPPLY_HEAD_M;
    if (id === DRAIN) return 0;
    const t = this.tanks.get(id);
    return t ? t.volumeL / 1000 / t.areaM2 : 0;
  }

  /** Withdraw up to `liters`; returns what was actually available. */
  take(id: string, liters: number): number {
    if (liters <= 0) return 0;
    if (id === SUPPLY) return liters;
    if (id === DRAIN) return 0; // can't pump out of the sewer
    const t = this.tanks.get(id);
    if (!t) return 0;
    const got = Math.min(t.volumeL, liters);
    t.volumeL -= got;
    return got;
  }

  /** Deposit up to `liters`; returns what fit (rest stays with the caller). */
  add(id: string, liters: number): number {
    if (liters <= 0) return 0;
    if (id === DRAIN) return liters;
    if (id === SUPPLY) return 0; // can't push into the mains
    const t = this.tanks.get(id);
    if (!t) return 0;
    const fits = Math.min(t.capacityL - t.volumeL, liters);
    t.volumeL += fits;
    return fits;
  }
}

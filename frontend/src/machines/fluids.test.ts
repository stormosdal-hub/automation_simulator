import { describe, expect, it } from 'vitest';
import { DRAIN, FluidNet, SUPPLY } from './fluids';

describe('FluidNet', () => {
  it('initializes a tank volume from the initial percentage', () => {
    const net = new FluidNet();
    net.register('t1', /*areaM2*/ 1, /*heightM*/ 2, /*initPct*/ 50, 0, 0);
    // capacity = 1 * 2 * 1000 = 2000 L; 50% => 1000 L
    expect(net.get('t1')?.capacityL).toBe(2000);
    expect(net.get('t1')?.volumeL).toBe(1000);
    expect(net.levelPct('t1')).toBeCloseTo(50);
  });

  it('clamps the initial percentage to [0,100]', () => {
    const net = new FluidNet();
    net.register('hi', 1, 1, 150, 0, 0);
    net.register('lo', 1, 1, -20, 0, 0);
    expect(net.levelPct('hi')).toBeCloseTo(100);
    expect(net.levelPct('lo')).toBeCloseTo(0);
  });

  it('keeps existing water when a tank is re-registered (rig rebuild / drag)', () => {
    const net = new FluidNet();
    net.register('t1', 1, 2, 25, 0, 0); // 500 L
    net.take('t1', 100); // 400 L
    net.register('t1', 1, 2, 90, 5, 5); // re-register with new init + position
    // volume is preserved, NOT reset to the new initPct
    expect(net.get('t1')?.volumeL).toBe(400);
    expect(net.get('t1')?.x).toBe(5);
  });

  it('caps preserved volume at the new capacity when a tank shrinks', () => {
    const net = new FluidNet();
    net.register('t1', 2, 2, 100, 0, 0); // cap 4000, full
    net.register('t1', 1, 1, 100, 0, 0); // cap 1000 now
    expect(net.get('t1')?.volumeL).toBe(1000);
  });

  it('take() withdraws only what is available and drains the tank', () => {
    const net = new FluidNet();
    net.register('t1', 1, 1, 10, 0, 0); // 100 L
    expect(net.take('t1', 30)).toBe(30);
    expect(net.get('t1')?.volumeL).toBe(70);
    // asking for more than remains returns only the remainder
    expect(net.take('t1', 999)).toBe(70);
    expect(net.get('t1')?.volumeL).toBe(0);
    expect(net.take('t1', 10)).toBe(0); // empty source starves
  });

  it('add() deposits only what fits and returns the overflow shortfall', () => {
    const net = new FluidNet();
    net.register('t1', 1, 1, 90, 0, 0); // 900 L, cap 1000
    expect(net.add('t1', 50)).toBe(50);
    expect(net.get('t1')?.volumeL).toBe(950);
    // only 50 L of headroom left
    expect(net.add('t1', 200)).toBe(50);
    expect(net.get('t1')?.volumeL).toBe(1000);
  });

  it('models supply as an infinite source and drain as an infinite sink', () => {
    const net = new FluidNet();
    expect(net.take(SUPPLY, 1000)).toBe(1000); // mains never runs dry
    expect(net.add(SUPPLY, 1000)).toBe(0); // can't push into the mains
    expect(net.add(DRAIN, 1000)).toBe(1000); // sewer always accepts
    expect(net.take(DRAIN, 1000)).toBe(0); // can't pump out of the sewer
    expect(net.has(SUPPLY)).toBe(true);
    expect(net.has(DRAIN)).toBe(true);
  });

  it('surfaceM reports fluid head that drives gravity valves', () => {
    const net = new FluidNet();
    net.register('t1', 2, 3, 100, 0, 0); // full: volume 6000 L, area 2 m² => 3 m
    expect(net.surfaceM('t1')).toBeCloseTo(3);
    net.take('t1', 3000); // half
    expect(net.surfaceM('t1')).toBeCloseTo(1.5);
    expect(net.surfaceM(SUPPLY)).toBeCloseTo(1.5); // constant mains head
    expect(net.surfaceM(DRAIN)).toBe(0);
  });

  it('a filling loop converges: supply -> tank via fixed flow per tick', () => {
    const net = new FluidNet();
    net.register('t1', 1, 1, 0, 0, 0); // empty, cap 1000 L
    // 100 ticks moving 20 L each from supply into the tank
    for (let i = 0; i < 100; i++) {
      const got = net.take(SUPPLY, 20);
      net.add('t1', got);
    }
    // 2000 L attempted into a 1000 L tank => brimful, no overflow past cap
    expect(net.get('t1')?.volumeL).toBe(1000);
    expect(net.levelPct('t1')).toBeCloseTo(100);
  });

  it('unregister removes the tank', () => {
    const net = new FluidNet();
    net.register('t1', 1, 1, 50, 0, 0);
    net.unregister('t1');
    expect(net.get('t1')).toBeUndefined();
    expect(net.has('t1')).toBe(false);
    expect(net.levelPct('t1')).toBe(0);
  });
});

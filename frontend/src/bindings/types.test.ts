import { describe, expect, it } from 'vitest';
import { applyTransform, type TransformSpec } from './types';

describe('applyTransform', () => {
  it('passthrough returns the value unchanged', () => {
    expect(applyTransform({ kind: 'passthrough' }, 42)).toBe(42);
    expect(applyTransform({ kind: 'passthrough' }, true)).toBe(true);
  });

  describe('linear', () => {
    const spec: TransformSpec = { kind: 'linear', inMin: 0, inMax: 100, outMin: 0, outMax: 1 };

    it('maps the input range onto the output range', () => {
      expect(applyTransform(spec, 0)).toBeCloseTo(0);
      expect(applyTransform(spec, 50)).toBeCloseTo(0.5);
      expect(applyTransform(spec, 100)).toBeCloseTo(1);
    });

    it('clamps out-of-range inputs to the output bounds', () => {
      expect(applyTransform(spec, -20)).toBeCloseTo(0);
      expect(applyTransform(spec, 250)).toBeCloseTo(1);
    });

    it('supports inverted / offset output ranges', () => {
      const inv: TransformSpec = { kind: 'linear', inMin: 0, inMax: 10, outMin: 90, outMax: -90 };
      expect(applyTransform(inv, 0)).toBeCloseTo(90);
      expect(applyTransform(inv, 5)).toBeCloseTo(0);
      expect(applyTransform(inv, 10)).toBeCloseTo(-90);
    });

    it('avoids divide-by-zero when inMin === inMax', () => {
      const degenerate: TransformSpec = { kind: 'linear', inMin: 5, inMax: 5, outMin: 7, outMax: 99 };
      expect(applyTransform(degenerate, 5)).toBe(7);
      expect(applyTransform(degenerate, 100)).toBe(7);
    });

    it('returns null for a non-numeric input', () => {
      expect(applyTransform(spec, true)).toBeNull();
    });
  });

  describe('boolean', () => {
    const spec: TransformSpec = { kind: 'boolean', whenTrue: '#00ff00', whenFalse: '#111111' };

    it('picks whenTrue / whenFalse from a boolean input', () => {
      expect(applyTransform(spec, true)).toBe('#00ff00');
      expect(applyTransform(spec, false)).toBe('#111111');
    });

    it('treats a numeric input as true above 0.5', () => {
      expect(applyTransform(spec, 1)).toBe('#00ff00');
      expect(applyTransform(spec, 0.5)).toBe('#111111');
      expect(applyTransform(spec, 0)).toBe('#111111');
    });
  });

  describe('threshold', () => {
    const spec: TransformSpec = {
      kind: 'threshold',
      stops: [
        { upTo: 25, value: 'low' },
        { upTo: 75, value: 'mid' },
        { upTo: null, value: 'high' },
      ],
    };

    it('selects the first stop whose upTo bound the value does not exceed', () => {
      expect(applyTransform(spec, 10)).toBe('low');
      expect(applyTransform(spec, 25)).toBe('low'); // inclusive upper bound
      expect(applyTransform(spec, 26)).toBe('mid');
      expect(applyTransform(spec, 75)).toBe('mid');
      expect(applyTransform(spec, 76)).toBe('high'); // else bucket
      expect(applyTransform(spec, 9999)).toBe('high');
    });

    it('returns null when no stop matches and there is no else bucket', () => {
      const noElse: TransformSpec = { kind: 'threshold', stops: [{ upTo: 10, value: 'x' }] };
      expect(applyTransform(noElse, 5)).toBe('x');
      expect(applyTransform(noElse, 50)).toBeNull();
    });

    it('returns null for a non-numeric input', () => {
      expect(applyTransform(spec, true)).toBeNull();
    });
  });
});

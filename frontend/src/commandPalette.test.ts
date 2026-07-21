// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fuzzyScore } from './commandPalette';

/** Helper: is `a` a better (higher) match for `q` than `b`? */
function ranksAbove(q: string, a: string, b: string): boolean {
  const sa = fuzzyScore(a, q);
  const sb = fuzzyScore(b, q);
  if (sa === null) return false;
  if (sb === null) return true;
  return sa > sb;
}

describe('fuzzyScore', () => {
  it('scores an empty query as 0 (everything matches)', () => {
    expect(fuzzyScore('anything', '')).toBe(0);
  });

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyScore('Live tags', 'xyz')).toBeNull();
    expect(fuzzyScore('abc', 'cba')).toBeNull(); // order matters
  });

  it('matches a subsequence in order', () => {
    expect(fuzzyScore('Live tags', 'lt')).not.toBeNull();
    expect(fuzzyScore('Connections', 'con')).not.toBeNull();
  });

  it('ranks a word-boundary match above a mid-word one', () => {
    // "lt": "Live tags" (l+t both at word starts) beats "default" (l,t mid-word)
    expect(ranksAbove('lt', 'Live tags', 'default')).toBe(true);
  });

  it('ranks a contiguous prefix match highest', () => {
    expect(ranksAbove('con', 'Connections', 'beacon')).toBe(true);
  });

  it('ranks an exact-ish shorter target above a longer one', () => {
    expect(ranksAbove('trend', 'Trends', 'Trend data historian archive')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('ALARMS', 'alarm')).not.toBeNull();
    expect(fuzzyScore('alarms', 'ALARM')).not.toBeNull();
  });
});

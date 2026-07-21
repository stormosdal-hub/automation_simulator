// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { panelRegistry, slugifyPanelTitle } from './panelRegistry';

function makePanel(id: string) {
  const root = document.createElement('div');
  root.dataset.testPanel = id;
  document.body.append(root);
  return root;
}

function clearRegistry() {
  for (const e of panelRegistry.list()) panelRegistry.unregister(e.id);
  localStorage.clear();
}

describe('slugifyPanelTitle', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyPanelTitle('Live tags')).toBe('live-tags');
    expect(slugifyPanelTitle('Record / Replay')).toBe('record-replay');
    expect(slugifyPanelTitle('Connections')).toBe('connections');
  });
  it('falls back to "panel" for empty slugs', () => {
    expect(slugifyPanelTitle('  !!! ')).toBe('panel');
  });
});

describe('panelRegistry', () => {
  beforeEach(clearRegistry);
  afterEach(clearRegistry);

  it('registers a panel visible by default and controls its display', () => {
    const root = makePanel('a');
    panelRegistry.register({ id: 'a', title: 'A', column: 'right', root });
    expect(panelRegistry.list().find((e) => e.id === 'a')?.visible).toBe(true);
    expect(root.style.display).toBe('');
    panelRegistry.setVisible('a', false);
    expect(root.style.display).toBe('none');
  });

  it('keeps an unavailable panel hidden even when marked visible', () => {
    const root = makePanel('scene');
    panelRegistry.register({ id: 'scene', title: 'Scene', column: 'left', root, available: false });
    expect(root.style.display).toBe('none'); // visible=true but available=false
    panelRegistry.setAvailable('scene', true);
    expect(root.style.display).toBe(''); // now shown
  });

  it('persists visibility across a re-register (rig/panel rebuild keeps intent)', () => {
    const root = makePanel('t');
    panelRegistry.register({ id: 't', title: 'T', column: 'right', root });
    panelRegistry.setVisible('t', false);
    // re-register with a fresh DOM node (as a control-panel rebuild would)
    const root2 = makePanel('t2');
    panelRegistry.register({ id: 't', title: 'T', column: 'right', root: root2 });
    expect(panelRegistry.list().find((e) => e.id === 't')?.visible).toBe(false);
    expect(root2.style.display).toBe('none');
  });

  it('reads persisted visibility from localStorage on first register', () => {
    localStorage.setItem('panel:visible:x', '0');
    const root = makePanel('x');
    panelRegistry.register({ id: 'x', title: 'X', column: 'right', root });
    expect(panelRegistry.list().find((e) => e.id === 'x')?.visible).toBe(false);
  });

  describe('applyPreset', () => {
    function seed() {
      panelRegistry.register({ id: 'connections', title: 'Connections', column: 'right', root: makePanel('c') });
      panelRegistry.register({ id: 'live-tags', title: 'Live tags', column: 'right', root: makePanel('lt') });
      panelRegistry.register({ id: 'machines', title: 'Machines', column: 'left', root: makePanel('m') });
      panelRegistry.register({ id: 'cp:1', title: 'Ctrl', column: 'right', root: makePanel('cp') });
    }

    it('shows exactly the preset ids and hides the rest', () => {
      seed();
      panelRegistry.applyPreset('diagnose'); // connections, alarms, record-replay, live-tags
      const vis = new Map(panelRegistry.list().map((e) => [e.id, e.visible]));
      expect(vis.get('connections')).toBe(true);
      expect(vis.get('live-tags')).toBe(true);
      expect(vis.get('machines')).toBe(false);
      expect(panelRegistry.activePresetId()).toBe('diagnose');
    });

    it('opts control panels in as a group via the synthetic control-panels id', () => {
      seed();
      panelRegistry.applyPreset('operate'); // lists 'control-panels'
      const cp = panelRegistry.list().find((e) => e.id === 'cp:1');
      expect(cp?.visible).toBe(true); // cp: prefix grouped in
      // build does NOT list control-panels
      panelRegistry.applyPreset('build');
      expect(panelRegistry.list().find((e) => e.id === 'cp:1')?.visible).toBe(false);
    });

    it('"all" shows every registered panel', () => {
      seed();
      panelRegistry.applyPreset('diagnose');
      panelRegistry.applyPreset('all');
      expect(panelRegistry.list().every((e) => e.visible)).toBe(true);
    });

    it('a manual toggle clears the active preset', () => {
      seed();
      panelRegistry.applyPreset('operate');
      expect(panelRegistry.activePresetId()).toBe('operate');
      panelRegistry.setVisible('machines', true);
      expect(panelRegistry.activePresetId()).toBeNull();
    });
  });

  it('notifies onChange listeners and unsubscribes cleanly', () => {
    let count = 0;
    const off = panelRegistry.onChange(() => (count += 1));
    panelRegistry.register({ id: 'z', title: 'Z', column: 'right', root: makePanel('z') });
    expect(count).toBeGreaterThan(0);
    const at = count;
    off();
    panelRegistry.setVisible('z', false);
    expect(count).toBe(at); // no further notifications after unsubscribe
  });
});

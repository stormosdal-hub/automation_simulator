/**
 * Central registry of every overlay panel, so the topbar **Panels ▾** menu can
 * show/hide them individually and apply/save workspace presets (bulk on/off).
 *
 * Two things register here: the fixed named panels created in main.ts
 * (Connections, Live tags, Machines, …) via createPanel, and the dynamic
 * project control panels created in controlPanels.ts. Each entry carries a
 * stable `id` (slug of the title for named panels, the project panel id for
 * control panels), the column it lives in, and an `available` flag — some
 * panels (Scene / Bindings) only make sense once a GLB model has loaded, so
 * they stay unavailable (and untogglable) until then.
 *
 * Per-panel visibility persists to localStorage keyed by id; a null persisted
 * value means "never set", so a panel defaults to visible. Workspace presets
 * (Build / Operate / Diagnose) are hard-coded id sets applied in bulk.
 */

export type PanelColumn = 'left' | 'right';

export interface PanelEntry {
  id: string;
  title: string;
  column: PanelColumn;
  root: HTMLElement;
  /** false while the panel's data source is absent (e.g. no 3D model yet) */
  available: boolean;
  /** user-facing visibility intent (independent of availability) */
  visible: boolean;
}

export interface WorkspacePreset {
  id: string;
  label: string;
  /** panel ids that should be visible; everything else is hidden */
  panels: string[];
}

/**
 * Presets reference panels by their slug id. "All" is handled specially in the
 * menu (show every available panel) so it needs no explicit list.
 */
export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    id: 'build',
    label: 'Build',
    // authoring a line: place machines, wire bindings, watch tags
    panels: ['machines', 'scene', 'bindings', 'live-tags', 'connections'],
  },
  {
    id: 'operate',
    label: 'Operate',
    // running it: controls, trends, live values, alarms
    panels: ['control-panels', 'trends', 'live-tags', 'alarms'],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    // troubleshooting: connections, alarms, record/replay, raw tags
    panels: ['connections', 'alarms', 'record-replay', 'live-tags'],
  },
];

export function slugifyPanelTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'panel'
  );
}

/** Per-panel settings that persist to localStorage. */
export type PanelProp = 'visible' | 'collapsed' | 'height';

/**
 * The one key shape for every persisted per-panel setting: `panel:<id>:<prop>`.
 * Everything is keyed by the registry **id** — visibility used to live under
 * `panel:visible:<id>` while `panel.ts` keyed collapse/height by *title*, so
 * renaming a panel silently orphaned half its saved state.
 * (`ACTIVE_PRESET_KEY` is global, not per-panel, and keeps its 2-segment shape.)
 */
export function panelKey(id: string, prop: PanelProp): string {
  return `panel:${id}:${prop}`;
}

/**
 * Read a setting, migrating it off its pre-unification key on first run: the
 * legacy value is copied to `panelKey(id, prop)` and the old key deleted. A
 * value already stored under the new key wins (the legacy one is just cleaned
 * up). Returns the value now in effect, or null when neither key exists.
 */
export function readPanelSetting(id: string, prop: PanelProp, legacyKey: string): string | null {
  const key = panelKey(id, prop);
  const current = localStorage.getItem(key);
  if (current !== null) {
    if (key !== legacyKey) localStorage.removeItem(legacyKey);
    return current;
  }
  const legacy = localStorage.getItem(legacyKey);
  if (legacy === null) return null;
  localStorage.setItem(key, legacy);
  localStorage.removeItem(legacyKey);
  return legacy;
}

/** Pre-unification visibility key, migrated away on first read. */
const LEGACY_VISIBLE_PREFIX = 'panel:visible:';
const ACTIVE_PRESET_KEY = 'panel:workspace';

type Listener = () => void;

class PanelRegistry {
  private entries: PanelEntry[] = [];
  private listeners = new Set<Listener>();
  private activePreset: string | null = localStorage.getItem(ACTIVE_PRESET_KEY);

  /**
   * Register a panel. `id` should be stable across reloads (slug for named
   * panels, project id for control panels). Reads persisted visibility;
   * defaults to visible when never set. If a panel with this id already exists
   * (control-panel rebuild) the existing entry is replaced but its visibility
   * intent is preserved.
   */
  register(opts: { id: string; title: string; column: PanelColumn; root: HTMLElement; available?: boolean }): PanelEntry {
    const prior = this.entries.find((e) => e.id === opts.id);
    const persisted = readPanelSetting(opts.id, 'visible', LEGACY_VISIBLE_PREFIX + opts.id);
    const visible = prior ? prior.visible : persisted === null ? true : persisted === '1';
    const entry: PanelEntry = {
      id: opts.id,
      title: opts.title,
      column: opts.column,
      root: opts.root,
      available: opts.available ?? true,
      visible,
    };
    if (prior) this.entries = this.entries.filter((e) => e.id !== opts.id);
    this.entries.push(entry);
    this.applyDisplay(entry);
    this.emit();
    return entry;
  }

  unregister(id: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length !== before) this.emit();
  }

  list(): PanelEntry[] {
    return [...this.entries];
  }

  /** Mark a panel available/unavailable (e.g. Scene once a model loads). */
  setAvailable(id: string, available: boolean): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry || entry.available === available) return;
    entry.available = available;
    this.applyDisplay(entry);
    this.emit();
  }

  setVisible(id: string, visible: boolean, persist = true): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;
    entry.visible = visible;
    if (persist) localStorage.setItem(panelKey(id, 'visible'), visible ? '1' : '0');
    this.applyDisplay(entry);
    // a manual toggle drops out of any named preset
    this.activePreset = null;
    localStorage.removeItem(ACTIVE_PRESET_KEY);
    this.emit();
  }

  toggle(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) this.setVisible(id, !entry.visible);
  }

  activePresetId(): string | null {
    return this.activePreset;
  }

  /** Apply a preset by id, or the special 'all' (show every available panel). */
  applyPreset(presetId: string): void {
    if (presetId === 'all') {
      for (const e of this.entries) {
        e.visible = true;
        localStorage.setItem(panelKey(e.id, 'visible'), '1');
        this.applyDisplay(e);
      }
    } else {
      const preset = WORKSPACE_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const wanted = new Set(preset.panels);
      // control panels register under 'cp:<projectId>' ids; a preset opts them
      // all in as a group via the synthetic 'control-panels' entry.
      const wantControlPanels = wanted.has('control-panels');
      for (const e of this.entries) {
        const isControlPanel = e.id.startsWith('cp:');
        e.visible = isControlPanel ? wantControlPanels : wanted.has(e.id);
        localStorage.setItem(panelKey(e.id, 'visible'), e.visible ? '1' : '0');
        this.applyDisplay(e);
      }
    }
    this.activePreset = presetId;
    localStorage.setItem(ACTIVE_PRESET_KEY, presetId);
    this.emit();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** A panel is shown only when the user wants it AND it's available. */
  private applyDisplay(entry: PanelEntry): void {
    entry.root.style.display = entry.visible && entry.available ? '' : 'none';
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const panelRegistry = new PanelRegistry();

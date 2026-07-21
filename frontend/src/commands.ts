import type { Command, CommandProvider } from './commandPalette';
import { revealPanel } from './commandPalette';
import type { MachineEngine } from './machines/engine';
import { MACHINE_CATALOG } from './machines/types';
import { panelRegistry, WORKSPACE_PRESETS } from './panelRegistry';
import type { ProjectStore } from './projectStore';
import type { Selection } from './selection';
import type { TagStore } from './tagStore';

interface Deps {
  projectStore: ProjectStore;
  store: TagStore;
  selection: Selection;
  engine: MachineEngine;
}

/** Flash a Live-tags row so the eye lands on the tag the palette jumped to. */
function flashTagRow(tagId: string): void {
  // escape the id for a CSS attribute selector
  const row = document.querySelector<HTMLElement>(
    `#tag-table tr[data-tag="${CSS.escape(tagId)}"]`,
  );
  if (!row) return;
  row.scrollIntoView({ block: 'nearest' });
  row.classList.add('tag-flash');
  setTimeout(() => row.classList.remove('tag-flash'), 1000);
}

/**
 * Assemble the command-palette providers from the app's live state. Each
 * provider is called fresh every time the palette opens, so machines and tags
 * are always current. Order here is the display order under "no query".
 */
export function buildCommandProviders(deps: Deps): CommandProvider[] {
  // --- Workspace presets ---
  const presets: CommandProvider = () => {
    const cmds: Command[] = WORKSPACE_PRESETS.map((p) => ({
      id: `preset:${p.id}`,
      title: `Workspace: ${p.label}`,
      matchText: p.label,
      category: 'Workspace',
      keywords: 'preset layout',
      run: () => panelRegistry.applyPreset(p.id),
    }));
    cmds.push({
      id: 'preset:all',
      title: 'Workspace: All panels',
      matchText: 'All panels',
      category: 'Workspace',
      keywords: 'preset show everything',
      run: () => panelRegistry.applyPreset('all'),
    });
    return cmds;
  };

  // --- Panels: show/hide/jump ---
  const panels: CommandProvider = () =>
    panelRegistry
      .list()
      .filter((e) => !e.id.startsWith('cp:') || e.available)
      .map((e) => ({
        id: `panel:${e.id}`,
        title: e.visible ? `Go to panel: ${e.title}` : `Show panel: ${e.title}`,
        matchText: e.title,
        category: 'Panel',
        keywords: e.available ? 'toggle visible' : 'unavailable needs model',
        run: () => {
          if (!e.available) return;
          revealPanel(e.id);
        },
      }));

  // --- Machines: select + reveal the Machines panel ---
  const machines: CommandProvider = () =>
    (deps.projectStore.project.machines ?? []).map((m) => {
      const label = MACHINE_CATALOG.find((d) => d.kind === m.kind)?.label ?? m.kind;
      return {
        id: `machine:${m.id}`,
        title: `Select machine: ${m.name}`,
        matchText: m.name,
        category: `Machine · ${label}`,
        keywords: `${m.kind} ${m.id}`,
        run: () => {
          revealPanel('machines');
          deps.selection.set(`machine:${m.id}`);
        },
      };
    });

  // --- Tags: reveal Live tags + flash the row ---
  const tags: CommandProvider = () =>
    deps.store.rows().map((r) => ({
      id: `tag:${r.meta.id}`,
      title: r.meta.id,
      category: `Tag${r.meta.writable ? ' · writable' : ''}`,
      keywords: `${r.meta.label ?? ''} ${r.meta.adapterId ?? ''} ${r.meta.dataType ?? ''}`,
      run: () => {
        revealPanel('live-tags');
        // let the reveal/expand settle before scrolling to the row
        setTimeout(() => flashTagRow(r.meta.id), 60);
      },
    }));

  // --- Actions: engine + global toggles ---
  const actions: CommandProvider = () => {
    const cmds: Command[] = [
      {
        id: 'action:arrange',
        title: `Arrange mode: ${deps.engine.arrangeMode ? 'turn OFF' : 'turn ON'}`,
        category: 'Action',
        keywords: 'move drag machines layout',
        run: () => {
          deps.engine.arrangeMode = !deps.engine.arrangeMode;
        },
      },
      {
        id: 'action:clear-parts',
        title: 'Clear all parts',
        category: 'Action',
        keywords: 'remove boxes reset',
        run: () => deps.engine.clearParts(),
      },
    ];
    return cmds;
  };

  return [presets, panels, machines, tags, actions];
}

import { button, div } from './ui';
import { panelRegistry, WORKSPACE_PRESETS, type PanelEntry } from './panelRegistry';

/**
 * Topbar **Panels ▾** dropdown: workspace presets (Build / Operate / Diagnose /
 * All) that show/hide panels in bulk, plus a checkbox per registered panel to
 * toggle it individually. Re-renders whenever the registry changes (a panel
 * registers/unregisters, a control panel is added, a preset is applied).
 *
 * Follows the same open/close pattern as FileMenu / OnlineMenu (click trigger
 * to toggle, click-away to close). data-role attrs for headless testing:
 * `panels-menu`, `panels-menu-trigger`, `panels-preset[data-preset]`,
 * `panels-toggle[data-panel]`.
 */
export class PanelsMenu {
  private menuEl: HTMLElement;
  private isOpen = false;

  constructor(container: HTMLElement) {
    const root = div('panels-menu');
    root.dataset.role = 'panels-menu';

    const trigger = button('Panels ▾', 'btn btn-small');
    trigger.dataset.role = 'panels-menu-trigger';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.isOpen);
    });

    this.menuEl = div('panels-menu-dropdown');
    this.menuEl.hidden = true;
    // keep clicks inside the menu from closing it (checkboxes, preset buttons)
    this.menuEl.addEventListener('click', (e) => e.stopPropagation());

    root.append(trigger, this.menuEl);
    container.append(root);

    document.addEventListener('click', () => this.setOpen(false));
    panelRegistry.onChange(() => {
      if (this.isOpen) this.render();
    });
  }

  private setOpen(open: boolean): void {
    this.isOpen = open;
    this.menuEl.hidden = !open;
    if (open) this.render();
  }

  private render(): void {
    this.menuEl.innerHTML = '';

    // --- Workspace presets ---
    const presetTitle = div('panels-section-title');
    presetTitle.textContent = 'Workspace';
    this.menuEl.append(presetTitle);

    const active = panelRegistry.activePresetId();
    const presetRow = div('panels-preset-row');
    const presets = [...WORKSPACE_PRESETS, { id: 'all', label: 'All', panels: [] }];
    for (const p of presets) {
      const b = button(p.label, 'btn btn-small');
      b.dataset.role = 'panels-preset';
      b.dataset.preset = p.id;
      if (active === p.id) b.classList.add('preset-active');
      b.addEventListener('click', () => panelRegistry.applyPreset(p.id));
      presetRow.append(b);
    }
    this.menuEl.append(presetRow);

    // --- Individual toggles, grouped by column ---
    const entries = panelRegistry.list();
    const columns: Array<{ side: 'left' | 'right'; label: string }> = [
      { side: 'left', label: 'Left column' },
      { side: 'right', label: 'Right column' },
    ];
    for (const col of columns) {
      const inCol = entries.filter((e) => e.column === col.side);
      if (inCol.length === 0) continue;
      const title = div('panels-section-title');
      title.textContent = col.label;
      this.menuEl.append(title);
      for (const entry of inCol) this.menuEl.append(this.toggleRow(entry));
    }
  }

  private toggleRow(entry: PanelEntry): HTMLElement {
    const row = document.createElement('label');
    row.className = 'panels-toggle-row';
    row.dataset.role = 'panels-toggle';
    row.dataset.panel = entry.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = entry.visible;
    cb.disabled = !entry.available;
    cb.addEventListener('change', () => panelRegistry.setVisible(entry.id, cb.checked));

    const label = document.createElement('span');
    label.textContent = entry.title;
    if (!entry.available) {
      label.append(' ');
      const hint = document.createElement('span');
      hint.className = 'dim';
      hint.textContent = '(needs a 3D model)';
      label.append(hint);
    }

    row.append(cb, label);
    return row;
  }
}

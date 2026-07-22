import { panelKey, panelRegistry, readPanelSetting, slugifyPanelTitle, type PanelColumn } from './panelRegistry';

export interface Panel {
  root: HTMLElement;
  body: HTMLElement;
  id: string;
  setCollapsed(collapsed: boolean): void;
}

export interface PanelOpts {
  /** stable registry id; defaults to a slug of the title */
  id?: string;
  /** column the panel lives in; inferred from the host when omitted */
  column?: PanelColumn;
  /** false while the panel's data source is absent (Scene/Bindings pre-model) */
  available?: boolean;
}

/**
 * Collapsible overlay panel, stacked in the #panels container. Also registers
 * itself with the panelRegistry so the topbar **Panels ▾** menu can toggle its
 * visibility and workspace presets can show/hide it in bulk.
 * Collapsed state persists per title in localStorage.
 */
export function createPanel(title: string, host?: HTMLElement, actions?: HTMLElement[], opts?: PanelOpts): Panel {
  const container = host ?? document.getElementById('panels');
  if (!container) throw new Error('missing #panels container');

  // resolved up front: every persisted setting below is keyed by this id
  const id = opts?.id ?? slugifyPanelTitle(title);

  const root = document.createElement('div');
  root.className = 'panel';

  const header = document.createElement('div');
  header.className = 'panel-header';
  const titleEl = document.createElement('span');
  titleEl.textContent = title;
  const right = document.createElement('span');
  right.className = 'panel-actions';
  if (actions) {
    for (const action of actions) {
      action.addEventListener('click', (ev) => ev.stopPropagation());
      right.append(action);
    }
  }
  const chevron = document.createElement('span');
  right.append(chevron);
  header.append(titleEl, right);

  const body = document.createElement('div');
  body.className = 'panel-body';
  root.append(header, body);
  container.appendChild(root);

  // remember a height the user set by dragging the panel-body's resize grip.
  // The browser writes an inline `height` only on a manual resize, so a
  // non-empty body.style.height distinguishes user intent from content growth.
  const heightKey = panelKey(id, 'height');
  const savedHeight = readPanelSetting(id, 'height', `panel:${title}:height`);
  if (savedHeight) body.style.height = savedHeight;
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (body.style.height) localStorage.setItem(heightKey, body.style.height);
    }).observe(body);
  }

  const storageKey = panelKey(id, 'collapsed');
  let collapsed = readPanelSetting(id, 'collapsed', `panel:${title}:collapsed`) === '1';

  const apply = () => {
    root.classList.toggle('collapsed', collapsed);
    chevron.textContent = collapsed ? '▸' : '▾';
  };
  header.addEventListener('click', () => {
    collapsed = !collapsed;
    localStorage.setItem(storageKey, collapsed ? '1' : '0');
    apply();
  });
  apply();

  // infer the column from the host element when not given explicitly
  const inferredColumn: PanelColumn = container.id === 'panels-left' ? 'left' : 'right';
  panelRegistry.register({
    id,
    title,
    column: opts?.column ?? inferredColumn,
    root,
    available: opts?.available,
  });

  return {
    root,
    body,
    id,
    setCollapsed(c: boolean) {
      collapsed = c;
      localStorage.setItem(storageKey, c ? '1' : '0');
      apply();
    },
  };
}

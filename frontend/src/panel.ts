export interface Panel {
  root: HTMLElement;
  body: HTMLElement;
  setCollapsed(collapsed: boolean): void;
}

/**
 * Collapsible overlay panel, stacked in the #panels container. The same
 * component will host control panels (buttons/knobs/gauges) in Phase 4.
 * Collapsed state persists per title in localStorage.
 */
export function createPanel(title: string, host?: HTMLElement, actions?: HTMLElement[]): Panel {
  const container = host ?? document.getElementById('panels');
  if (!container) throw new Error('missing #panels container');

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

  const storageKey = `panel:${title}:collapsed`;
  let collapsed = localStorage.getItem(storageKey) === '1';

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

  return {
    root,
    body,
    setCollapsed(c: boolean) {
      collapsed = c;
      localStorage.setItem(storageKey, c ? '1' : '0');
      apply();
    },
  };
}

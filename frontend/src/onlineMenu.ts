import type { TagStore } from './tagStore';
import { button, div, textInput } from './ui';
import type { GatewayConnection } from './wsClient';

function normalizeUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * Online menu: manages the gateway's TIA connections — one or several PLCs.
 * Lists each connection (name, URL, online/RUN state) with Edit/Remove, and an
 * add/edit form (connection name + host:port) with Test (probes /api/info,
 * changes nothing) and Connect (hot-swaps/creates live, no restart). Works with
 * no `tiaweb` entry in config.json at all. A machine on the LAN/Wi-Fi or a
 * Raspberry Pi is just a different host:port.
 */
export class OnlineMenu {
  private menuEl: HTMLElement;
  private listEl: HTMLElement;
  private formTitleEl: HTMLElement;
  private idInput: HTMLInputElement;
  private urlInput: HTMLInputElement;
  private connectBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private resultEl: HTMLElement;
  private isOpen = false;
  private busy = false;
  private editingId: string | null = null;

  constructor(
    container: HTMLElement,
    private store: TagStore,
    private conn: GatewayConnection,
  ) {
    const root = div('online-menu');
    root.dataset.role = 'online-menu';

    const trigger = button('Online ▾', 'btn btn-small');
    trigger.dataset.role = 'online-menu-trigger';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.isOpen);
    });

    this.menuEl = div('online-menu-dropdown');
    this.menuEl.hidden = true;
    this.menuEl.addEventListener('click', (e) => e.stopPropagation());

    const listTitle = div('online-section-title');
    listTitle.textContent = 'TIA connections';
    this.listEl = div('online-list');
    this.listEl.dataset.role = 'online-list';

    this.formTitleEl = div('online-section-title');
    this.idInput = textInput('', 'connection name, e.g. line1', () => {});
    this.idInput.dataset.role = 'online-id-input';
    this.urlInput = textInput('', 'host:port, e.g. 192.168.1.50:8000', () => {});
    this.urlInput.dataset.role = 'online-url-input';

    const testBtn = button('Test', 'btn btn-small');
    testBtn.dataset.role = 'online-test';
    testBtn.addEventListener('click', () => void this.test());
    this.connectBtn = button('Connect', 'btn btn-small');
    this.connectBtn.dataset.role = 'online-connect';
    this.connectBtn.addEventListener('click', () => void this.connect());
    this.cancelBtn = button('Cancel', 'btn btn-small');
    this.cancelBtn.dataset.role = 'online-cancel';
    this.cancelBtn.hidden = true;
    this.cancelBtn.addEventListener('click', () => this.resetForm());

    const actions = div('online-actions');
    actions.append(testBtn, this.connectBtn, this.cancelBtn);
    this.resultEl = div('online-result');

    this.menuEl.append(
      listTitle,
      this.listEl,
      this.formTitleEl,
      labeled('name', this.idInput),
      labeled('address', this.urlInput),
      actions,
      this.resultEl,
    );
    root.append(trigger, this.menuEl);
    container.append(root);

    document.addEventListener('click', () => this.setOpen(false));
    setInterval(() => this.renderList(), 500);
    this.resetForm();
    this.renderList();
  }

  private setOpen(open: boolean): void {
    this.isOpen = open;
    this.menuEl.hidden = !open;
    if (open) this.renderList();
  }

  private connections(): { id: string; url: string }[] {
    return this.store.adapters
      .filter((a) => a.type === 'tiaweb')
      .map((a) => ({ id: a.id, url: a.url ?? '' }));
  }

  private suggestId(): string {
    const taken = new Set(this.store.adapters.map((a) => a.id));
    if (!taken.has('tia')) return 'tia';
    for (let i = 2; i < 100; i++) if (!taken.has(`tia${i}`)) return `tia${i}`;
    return 'tia';
  }

  private renderList(): void {
    const conns = this.connections();
    this.listEl.innerHTML = '';
    if (conns.length === 0) {
      const empty = div('online-empty dim');
      empty.textContent = 'No PLC connected. Add one below.';
      this.listEl.append(empty);
      return;
    }
    for (const c of conns) {
      const row = div('online-conn-row');
      row.dataset.conn = c.id;
      const online = this.store.bool(`${c.id}.online`);
      const running = this.store.bool(`${c.id}.running`);
      const dot = div(`conn-dot ${online ? 'up' : 'down'}`);
      const label = div('online-conn-label');
      const run =
        running === null ? '' : ` <span class="${running ? 'ok' : 'dim'}">${running ? 'RUN' : 'STOP'}</span>`;
      label.innerHTML = `<b>${c.id}</b> <span class="dim">${c.url}</span>${run}`;
      const edit = button('Edit', 'btn btn-small');
      edit.dataset.role = 'online-edit';
      edit.addEventListener('click', () => this.startEdit(c.id, c.url));
      const remove = button('Remove', 'btn btn-small');
      remove.dataset.role = 'online-remove';
      remove.addEventListener('click', () => void this.remove(c.id));
      const acts = div('online-conn-actions');
      acts.append(edit, remove);
      row.append(dot, label, acts);
      this.listEl.append(row);
    }
  }

  private resetForm(): void {
    this.editingId = null;
    this.formTitleEl.textContent = 'Add a connection';
    this.idInput.disabled = false;
    this.idInput.value = this.suggestId();
    this.urlInput.value = '';
    this.connectBtn.textContent = 'Connect';
    this.cancelBtn.hidden = true;
    this.resultEl.textContent = '';
  }

  private startEdit(id: string, url: string): void {
    this.editingId = id;
    this.formTitleEl.textContent = `Redirect “${id}”`;
    this.idInput.disabled = true;
    this.idInput.value = id;
    this.urlInput.value = url;
    this.connectBtn.textContent = 'Reconnect';
    this.cancelBtn.hidden = false;
    this.resultEl.textContent = '';
    this.urlInput.focus();
  }

  private async test(): Promise<void> {
    if (this.busy) return;
    const url = normalizeUrl(this.urlInput.value);
    if (!url) {
      this.resultEl.textContent = 'Enter an address first.';
      return;
    }
    this.busy = true;
    this.resultEl.textContent = 'Testing…';
    try {
      const r = await this.conn.testTia(url);
      this.resultEl.textContent = r.ok ? '✓ reachable — TIA Web Practice runtime' : `✗ ${r.reason}`;
    } catch (err) {
      this.resultEl.textContent = `✗ ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.busy = false;
    }
  }

  private async connect(): Promise<void> {
    if (this.busy) return;
    const id = (this.editingId ?? this.idInput.value).trim();
    const url = normalizeUrl(this.urlInput.value);
    if (!id) {
      this.resultEl.textContent = 'Enter a connection name.';
      return;
    }
    if (!url) {
      this.resultEl.textContent = 'Enter an address.';
      return;
    }
    this.busy = true;
    this.resultEl.textContent = 'Connecting…';
    try {
      await this.conn.connectTia(id, url);
      this.renderList();
      this.resetForm(); // resetForm clears the result — set the confirmation AFTER it
      this.resultEl.textContent = `✓ ${id} connected`;
    } catch (err) {
      this.resultEl.textContent = `✗ ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.busy = false;
    }
  }

  private async remove(id: string): Promise<void> {
    if (!confirm(`Remove connection “${id}”? Its tags disappear from the scene (bindings to them go idle).`)) return;
    try {
      await this.conn.removeTia(id);
      if (this.editingId === id) this.resetForm();
      this.renderList();
    } catch (err) {
      this.resultEl.textContent = `✗ ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}

function labeled(label: string, control: HTMLElement): HTMLElement {
  const row = div('online-field');
  const l = document.createElement('label');
  l.textContent = label;
  row.append(l, control);
  return row;
}

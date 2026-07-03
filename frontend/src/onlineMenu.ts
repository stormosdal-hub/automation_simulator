import type { TagStore } from './tagStore';
import { button, div, textInput } from './ui';
import type { GatewayConnection } from './wsClient';

const TIA_ADAPTER_ID = 'tia';

function normalizeUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * Online menu: shows the current `tia` connection (URL, online/running) and
 * lets you switch it to a different TIA Web Practice runtime live — type a
 * host:port, Test it (probes /api/info without connecting), then Connect
 * (hot-swaps the gateway's tia adapter, no restart). Works even if no tia
 * adapter was declared in config.json at all — Connect creates one.
 */
export class OnlineMenu {
  private menuEl: HTMLElement;
  private statusEl: HTMLElement;
  private resultEl: HTMLElement;
  private urlValue = '';
  private isOpen = false;
  private busy = false;

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

    this.statusEl = div('online-status');
    this.resultEl = div('online-result');

    const input = textInput('', 'host:port, e.g. 192.168.1.50:8000', (v) => {
      this.urlValue = v;
    });
    input.dataset.role = 'online-url-input';

    const testBtn = button('Test connection', 'btn btn-small');
    testBtn.dataset.role = 'online-test';
    testBtn.addEventListener('click', () => void this.test());

    const connectBtn = button('Connect', 'btn btn-small');
    connectBtn.dataset.role = 'online-connect';
    connectBtn.addEventListener('click', () => void this.connect());

    const actions = div('online-actions');
    actions.append(testBtn, connectBtn);

    this.menuEl.append(this.statusEl, input, actions, this.resultEl);
    root.append(trigger, this.menuEl);
    container.append(root);

    document.addEventListener('click', () => this.setOpen(false));
    setInterval(() => this.renderStatus(), 500);
    this.renderStatus();
  }

  private setOpen(open: boolean): void {
    this.isOpen = open;
    this.menuEl.hidden = !open;
    if (open) this.renderStatus();
  }

  private renderStatus(): void {
    const meta = this.store.adapters.find((a) => a.id === TIA_ADAPTER_ID);
    if (!meta) {
      this.statusEl.innerHTML = '<span class="dim">not connected</span>';
      return;
    }
    const online = this.store.bool(`${TIA_ADAPTER_ID}.online`);
    const running = this.store.bool(`${TIA_ADAPTER_ID}.running`);
    const dotClass = online ? 'ok' : 'bad';
    const runPart =
      running === null ? '' : ` · <span class="${running ? 'ok' : 'dim'}">${running ? 'RUN' : 'STOP'}</span>`;
    this.statusEl.innerHTML =
      `<span class="${dotClass}">${online ? 'online' : 'offline'}</span> ` +
      `<span class="dim">${meta.url ?? ''}</span>${runPart}`;
  }

  private async test(): Promise<void> {
    if (this.busy) return;
    const url = normalizeUrl(this.urlValue);
    if (!url) {
      this.resultEl.textContent = 'Enter a host or URL first.';
      return;
    }
    this.busy = true;
    this.resultEl.textContent = 'Testing…';
    try {
      const result = await this.conn.testTia(url);
      this.resultEl.textContent = result.ok ? '✓ reachable — TIA Web Practice runtime' : `✗ ${result.reason}`;
    } catch (err) {
      this.resultEl.textContent = `✗ ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.busy = false;
    }
  }

  private async connect(): Promise<void> {
    if (this.busy) return;
    const url = normalizeUrl(this.urlValue);
    if (!url) {
      this.resultEl.textContent = 'Enter a host or URL first.';
      return;
    }
    this.busy = true;
    this.resultEl.textContent = 'Connecting…';
    try {
      await this.conn.connectTia(url);
      this.resultEl.textContent = '✓ connected';
      this.renderStatus();
    } catch (err) {
      this.resultEl.textContent = `✗ ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.busy = false;
    }
  }
}

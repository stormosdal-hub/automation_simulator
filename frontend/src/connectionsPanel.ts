import type { TagStore } from './tagStore';
import { button, div } from './ui';
import type { GatewayConnection, WsStatus } from './wsClient';

const REFRESH_MS = 500;

type RefreshState = 'idle' | 'busy' | { error: string };

/**
 * Read-only adapter health: one row per adapter with its `<id>.online` state
 * and, where published, the device-liveness (LWT) state. The simulator has no
 * online tag — its dot mirrors the gateway connection itself. Adapters that
 * advertise `canRefreshTags` (currently just `tiaweb`, when not given an
 * explicit tag list) also get a "refresh tags" button to re-import tags after
 * editing the source program, with no restart.
 */
export class ConnectionsPanel {
  private refreshState = new Map<string, RefreshState>();

  constructor(
    private host: HTMLElement,
    private store: TagStore,
    private gatewayStatus: () => WsStatus,
    private conn: GatewayConnection,
  ) {
    setInterval(() => this.render(), REFRESH_MS);
    this.render();
  }

  private refresh(adapterId: string): void {
    this.refreshState.set(adapterId, 'busy');
    this.render();
    this.conn.refreshTags(adapterId).then(
      () => {
        this.refreshState.set(adapterId, 'idle');
        this.render();
      },
      (err: Error) => {
        this.refreshState.set(adapterId, { error: err.message });
        this.render();
      },
    );
  }

  private render(): void {
    const adapters = this.store.adapters;
    if (adapters.length === 0) {
      this.host.innerHTML = '<div class="dim">waiting for gateway…</div>';
      return;
    }
    this.host.innerHTML = '';
    for (const adapter of adapters) {
      const row = div('conn-row');
      row.dataset.adapter = adapter.id;

      const online = this.store.bool(`${adapter.id}.online`);
      const gatewayUp = this.gatewayStatus() === 'connected';
      const up = online === null ? gatewayUp : online === true && gatewayUp;

      const dot = div(`conn-dot ${up ? 'up' : 'down'}`);
      dot.title = up ? 'online' : 'offline';

      const label = div('conn-label');
      label.innerHTML = `${adapter.label} <span class="dim">${adapter.id} · ${adapter.type}</span>`;

      row.append(dot, label);

      const deviceOnline = this.store.bool(`${adapter.id}.deviceOnline`);
      if (deviceOnline !== null) {
        const device = div(`conn-device ${deviceOnline ? 'up' : 'down'}`);
        device.textContent = deviceOnline ? 'device ●' : 'device ○';
        device.title = deviceOnline ? 'device online (LWT)' : 'device offline (LWT)';
        row.append(device);
      }

      if (adapter.canRefreshTags) {
        const state = this.refreshState.get(adapter.id) ?? 'idle';
        const busy = state === 'busy';
        const refreshBtn = button(busy ? '⟳ …' : '⟳', 'icon-btn');
        refreshBtn.dataset.role = 'refresh-tags';
        refreshBtn.dataset.adapter = adapter.id;
        refreshBtn.disabled = busy;
        refreshBtn.title =
          typeof state === 'object'
            ? `Refresh failed: ${state.error} — click to retry`
            : 'Re-import tags from the source program';
        refreshBtn.addEventListener('click', () => this.refresh(adapter.id));
        row.append(refreshBtn);
      }
      this.host.append(row);
    }
  }
}

import type { TagStore } from './tagStore';
import type { WsStatus } from './wsClient';
import { div } from './ui';

const REFRESH_MS = 500;

/**
 * Read-only adapter health: one row per adapter with its `<id>.online` state
 * and, where published, the device-liveness (LWT) state. The simulator has no
 * online tag — its dot mirrors the gateway connection itself.
 */
export class ConnectionsPanel {
  constructor(
    private host: HTMLElement,
    private store: TagStore,
    private gatewayStatus: () => WsStatus,
  ) {
    setInterval(() => this.render(), REFRESH_MS);
    this.render();
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
      this.host.append(row);
    }
  }
}

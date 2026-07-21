import type { WsStatus } from './wsClient';

/**
 * Slim status overlay: gateway connection + scene state. Exposes
 * data-ws-status / data-scene attributes so headless checks can assert state.
 * Live tag values moved to the TagTable panel.
 */
export class Hud {
  private root = document.getElementById('hud')!;
  private status: WsStatus = 'connecting';

  constructor(private gatewayUrl: string) {
    this.root.dataset.scene = 'loading';
    this.render();
  }

  setStatus(status: WsStatus): void {
    this.status = status;
    this.render();
  }

  setScene(state: string): void {
    this.root.dataset.scene = state;
  }

  private render(): void {
    const statusClass = this.status === 'connected' ? 'ok' : 'bad';
    this.root.dataset.wsStatus = this.status;
    this.root.innerHTML =
      '<h1>Automation Sim</h1>' +
      `<div>gateway <span class="${statusClass}">${this.status}</span> <span class="dim">${this.gatewayUrl}</span></div>` +
      '<div class="dim">press <b>Ctrl</b>+<b>K</b> to jump anywhere</div>';
  }
}

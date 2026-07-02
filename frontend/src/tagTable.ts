import type { TagStore } from './tagStore';

const REFRESH_MS = 250;
const STALE_MS = 2500;

/** Live tag values with age and update rate; ages redden when data goes stale. */
export class TagTable {
  private tbody: HTMLTableSectionElement;
  private rates = new Map<string, { count: number; hz: number }>();
  private lastRefresh = Date.now();

  constructor(
    host: HTMLElement,
    private store: TagStore,
  ) {
    host.innerHTML =
      '<table id="tag-table"><thead><tr>' +
      '<th>tag</th><th>value</th><th>age</th><th>rate</th>' +
      '</tr></thead><tbody></tbody></table>';
    this.tbody = host.querySelector('tbody')!;
    setInterval(() => this.refresh(), REFRESH_MS);
    this.refresh();
  }

  private refresh(): void {
    const now = Date.now();
    const dt = (now - this.lastRefresh) / 1000;
    this.lastRefresh = now;

    const rows = this.store.rows();
    if (rows.length === 0) {
      this.tbody.innerHTML = '<tr><td colspan="4" class="dim">no tags yet</td></tr>';
      return;
    }

    this.tbody.innerHTML = rows
      .map((r) => {
        let value = '<span class="dim">—</span>';
        if (typeof r.value === 'boolean') {
          value = r.value ? '<span class="bool-true">true</span>' : '<span class="bool-false">false</span>';
        } else if (typeof r.value === 'number') {
          const unit = r.meta.unit ? ` <span class="dim">${r.meta.unit}</span>` : '';
          value = `${r.value.toFixed(1)}${unit}`;
        }

        let age = '';
        let ageClass = 'dim';
        if (r.receivedAt !== null) {
          const ms = now - r.receivedAt;
          age = ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
          if (ms > STALE_MS) ageClass = 'stale';
        }

        // exponential moving average keeps the Hz readout from flickering
        const prev = this.rates.get(r.meta.id) ?? { count: r.count, hz: 0 };
        const inst = dt > 0 ? (r.count - prev.count) / dt : 0;
        const hz = prev.hz * 0.6 + inst * 0.4;
        this.rates.set(r.meta.id, { count: r.count, hz });

        const writable = r.meta.writable ? ' <span class="dim" title="writable">✎</span>' : '';
        return (
          `<tr data-tag="${r.meta.id}" title="${r.meta.label}">` +
          `<td>${r.meta.id}${writable}</td>` +
          `<td class="v">${value}</td>` +
          `<td class="${ageClass}">${age}</td>` +
          `<td class="dim">${hz > 0.05 ? hz.toFixed(0) + ' Hz' : ''}</td>` +
          '</tr>'
        );
      })
      .join('');
  }
}

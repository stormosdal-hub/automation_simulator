import { panelRegistry } from './panelRegistry';

/**
 * Command palette (Ctrl/Cmd-K): a fuzzy-searchable overlay to jump to any
 * panel, machine, tag, workspace preset, or action without hunting through the
 * panel stack. Commands are contributed by `providers` — functions that return
 * a fresh list each time the palette opens (so tags/machines are always
 * current). Keyboard: Ctrl/Cmd-K or `/` toggles; ↑/↓ move; Enter runs; Esc
 * closes. data-role attrs for headless testing: `command-palette`,
 * `command-input`, `command-item[data-cmd-id]`.
 */

export interface Command {
  id: string;
  /** primary searchable label */
  title: string;
  /** group heading + secondary match text (e.g. 'Tag', 'Machine · conveyor') */
  category: string;
  /** optional extra keywords folded into the match (tag id, machine kind, …) */
  keywords?: string;
  /**
   * Clean text the fuzzy matcher scores against, WITHOUT the decorative title
   * prefix ("Go to panel:", "Select machine:"). Prefixes otherwise pollute
   * ranking (e.g. "lt" matching the 'l' in "panel:"). Defaults to `title`.
   */
  matchText?: string;
  run(): void;
}

export type CommandProvider = () => Command[];

interface Scored {
  cmd: Command;
  score: number;
}

/**
 * Subsequence fuzzy match: every char of `q` must appear in order in `text`.
 * Rewards contiguous runs, word-boundary starts, and earlier matches so that
 * "lt" ranks "Live tags" above "default". Returns null when `q` doesn't match.
 * Exported for unit testing.
 */
export function fuzzyScore(text: string, q: string): number | null {
  if (!q) return 0;
  const t = text.toLowerCase();
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q.toLowerCase()) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    // word-boundary bonus
    if (found === 0 || /[\s.:_-]/.test(t[found - 1] ?? '')) score += 8;
    // contiguity bonus
    if (found === ti) {
      streak += 1;
      score += 4 + streak;
    } else {
      streak = 0;
    }
    // earliness bonus (prefer matches near the front)
    score += Math.max(0, 5 - found * 0.15);
    ti = found + 1;
  }
  // shorter targets that fully consumed the query rank higher
  score += Math.max(0, 12 - (t.length - q.length) * 0.1);
  return score;
}

export class CommandPalette {
  private overlay: HTMLElement;
  private input: HTMLInputElement;
  private listEl: HTMLElement;
  private open = false;
  private commands: Command[] = [];
  private filtered: Scored[] = [];
  private activeIdx = 0;

  constructor(private providers: CommandProvider[]) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'command-overlay';
    this.overlay.dataset.role = 'command-palette';
    this.overlay.hidden = true;

    const box = document.createElement('div');
    box.className = 'command-box';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'command-input';
    this.input.dataset.role = 'command-input';
    this.input.placeholder = 'Jump to a panel, machine, tag, or action…';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;

    this.listEl = document.createElement('div');
    this.listEl.className = 'command-list';

    box.append(this.input, this.listEl);
    this.overlay.append(box);
    document.body.append(this.overlay);

    // clicking the dim backdrop (not the box) closes
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
    this.input.addEventListener('input', () => this.refilter());
    this.input.addEventListener('keydown', (e) => this.onKey(e));

    // global open shortcut
    window.addEventListener('keydown', (e) => {
      const cmdK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      if (cmdK) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.open) {
        this.close();
      }
    });
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.commands = this.providers.flatMap((p) => {
      try {
        return p();
      } catch {
        return [];
      }
    });
    this.open = true;
    this.overlay.hidden = false;
    this.input.value = '';
    this.refilter();
    this.input.focus();
  }

  close(): void {
    this.open = false;
    this.overlay.hidden = true;
  }

  private refilter(): void {
    const q = this.input.value.trim();
    if (!q) {
      // no query: show everything, grouped in provider order, capped
      this.filtered = this.commands.map((cmd) => ({ cmd, score: 0 })).slice(0, 80);
    } else {
      this.filtered = this.commands
        .map((cmd) => {
          const hay = `${cmd.matchText ?? cmd.title} ${cmd.category} ${cmd.keywords ?? ''}`;
          const score = fuzzyScore(hay, q);
          return score === null ? null : { cmd, score };
        })
        .filter((s): s is Scored => s !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 60);
    }
    this.activeIdx = 0;
    this.renderList();
  }

  private renderList(): void {
    this.listEl.innerHTML = '';
    if (this.filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-empty dim';
      empty.textContent = 'No matches';
      this.listEl.append(empty);
      return;
    }
    let lastCat = '';
    this.filtered.forEach(({ cmd }, i) => {
      if (cmd.category !== lastCat) {
        const cat = document.createElement('div');
        cat.className = 'command-cat';
        cat.textContent = cmd.category;
        this.listEl.append(cat);
        lastCat = cmd.category;
      }
      const row = document.createElement('div');
      row.className = 'command-item';
      row.dataset.role = 'command-item';
      row.dataset.cmdId = cmd.id;
      if (i === this.activeIdx) row.classList.add('active');
      row.textContent = cmd.title;
      row.addEventListener('mousemove', () => {
        if (this.activeIdx !== i) {
          this.activeIdx = i;
          this.highlight();
        }
      });
      row.addEventListener('click', () => this.runAt(i));
      this.listEl.append(row);
    });
  }

  private highlight(): void {
    const items = this.listEl.querySelectorAll<HTMLElement>('.command-item');
    items.forEach((el, i) => el.classList.toggle('active', i === this.activeIdx));
    items[this.activeIdx]?.scrollIntoView({ block: 'nearest' });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIdx = Math.min(this.activeIdx + 1, this.filtered.length - 1);
      this.highlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIdx = Math.max(this.activeIdx - 1, 0);
      this.highlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.runAt(this.activeIdx);
    }
  }

  private runAt(i: number): void {
    const entry = this.filtered[i];
    if (!entry) return;
    this.close();
    entry.cmd.run();
  }
}

/**
 * Reveal a panel by id: make it visible (if hidden), un-collapse it, scroll it
 * into view, and flash a highlight so the user's eye lands on it. Shared by the
 * panel/machine/tag jump commands.
 */
export function revealPanel(panelId: string): HTMLElement | null {
  const entry = panelRegistry.list().find((e) => e.id === panelId);
  if (!entry) return null;
  if (!entry.available) return null;
  if (!entry.visible) panelRegistry.setVisible(panelId, true);
  entry.root.classList.remove('collapsed');
  const body = entry.root.querySelector<HTMLElement>('.panel-body');
  if (body) body.style.display = '';
  entry.root.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  entry.root.classList.add('panel-flash');
  setTimeout(() => entry.root.classList.remove('panel-flash'), 1200);
  return entry.root;
}

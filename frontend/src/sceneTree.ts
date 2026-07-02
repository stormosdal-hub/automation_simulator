import { AbstractMesh } from '@babylonjs/core';
import type { Node, Scene } from '@babylonjs/core';
import type { Selection } from './selection';

interface TreeRow {
  name: string;
  depth: number;
  isMesh: boolean;
}

/** Model hierarchy browser: lists GLB nodes under __root__, click to select. */
export class SceneTree {
  private rows: TreeRow[] = [];

  constructor(
    private host: HTMLElement,
    private selection: Selection,
  ) {
    this.host.innerHTML = '<div class="dim">no model loaded</div>';
    selection.onChange(() => this.highlight());
  }

  setScene(scene: Scene): void {
    this.rows = [];
    const root = scene.getNodeByName('__root__');
    if (root) for (const child of root.getChildren()) this.walk(child, 0);
    this.render();
  }

  names(): string[] {
    return this.rows.map((r) => r.name);
  }

  private walk(node: Node, depth: number): void {
    if (node.name) {
      this.rows.push({ name: node.name, depth, isMesh: node instanceof AbstractMesh });
    }
    for (const child of node.getChildren()) this.walk(child, depth + 1);
  }

  private render(): void {
    if (this.rows.length === 0) {
      this.host.innerHTML = '<div class="dim">no model loaded</div>';
      return;
    }
    this.host.innerHTML = this.rows
      .map(
        (r) =>
          `<div class="tree-row" data-node="${r.name}" style="padding-left:${6 + r.depth * 14}px">` +
          `<span class="dim">${r.isMesh ? '◆' : '○'}</span> ${r.name}</div>`,
      )
      .join('');
    for (const el of this.host.querySelectorAll<HTMLElement>('.tree-row')) {
      el.addEventListener('click', () => this.selection.set(el.dataset.node ?? null));
    }
    this.highlight();
  }

  private highlight(): void {
    for (const el of this.host.querySelectorAll<HTMLElement>('.tree-row')) {
      el.classList.toggle('selected', el.dataset.node === this.selection.name);
    }
  }
}

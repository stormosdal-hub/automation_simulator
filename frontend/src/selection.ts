/** Shared "currently selected scene node" state between tree, viewport, and editor. */
export class Selection {
  private current: string | null = null;
  private listeners = new Set<(name: string | null) => void>();

  get name(): string | null {
    return this.current;
  }

  set(name: string | null): void {
    if (name === this.current) return;
    this.current = name;
    for (const listener of this.listeners) listener(name);
  }

  onChange(listener: (name: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

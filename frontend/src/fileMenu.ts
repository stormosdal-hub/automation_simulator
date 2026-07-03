import type { Project } from './bindings/types';
import type { ProjectStore } from './projectStore';
import { button, div } from './ui';

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'project';
}

function isProject(v: unknown): v is Project {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return p.version === 1 && typeof p.name === 'string' && typeof p.modelUrl === 'string' && Array.isArray(p.bindings);
}

/**
 * File menu: New / Open / Save project as JSON. New and Open fully replace
 * the current project and reload the page — bindings already react to
 * project changes live, but panels/widgets/alarms don't, so a bulk replace
 * needs a fresh boot to render cleanly everywhere.
 */
export class FileMenu {
  private menuEl: HTMLElement;
  private fileInput: HTMLInputElement;
  private isOpen = false;

  constructor(
    container: HTMLElement,
    private projectStore: ProjectStore,
  ) {
    const root = div('file-menu');
    root.dataset.role = 'file-menu';

    const trigger = button('File ▾', 'btn btn-small');
    trigger.dataset.role = 'file-menu-trigger';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.isOpen);
    });

    this.menuEl = div('file-menu-dropdown');
    this.menuEl.hidden = true;
    this.menuEl.append(
      this.item('New project', 'file-new', () => this.newProject()),
      this.item('Open project…', 'file-open', () => this.fileInput.click()),
      this.item('Save project as…', 'file-save', () => this.saveProject()),
    );

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/json,.json';
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => this.openProject());

    root.append(trigger, this.menuEl, this.fileInput);
    container.append(root);

    document.addEventListener('click', () => this.setOpen(false));
  }

  private item(label: string, role: string, onClick: () => void): HTMLButtonElement {
    const el = button(label, 'file-menu-item');
    el.dataset.role = role;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(false);
      onClick();
    });
    return el;
  }

  private setOpen(open: boolean): void {
    this.isOpen = open;
    this.menuEl.hidden = !open;
  }

  private newProject(): void {
    if (
      !confirm('Start a new project? This clears the current bindings, panels, and alarms (the 3D model stays loaded).')
    )
      return;
    this.projectStore.replace({
      version: 1,
      name: 'Untitled',
      modelUrl: this.projectStore.project.modelUrl,
      bindings: [],
      panels: [],
      alarms: [],
    });
    location.reload();
  }

  private saveProject(): void {
    download(`${slugify(this.projectStore.project.name)}.json`, this.projectStore.export());
  }

  private openProject(): void {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch {
        alert(`"${file.name}" is not valid JSON.`);
        return;
      }
      if (!isProject(parsed)) {
        alert(`"${file.name}" doesn't look like an Automation Sim project file.`);
        return;
      }
      if (!confirm(`Open "${file.name}"? This replaces the current project.`)) return;
      this.projectStore.replace(parsed);
      location.reload();
    };
    reader.readAsText(file);
  }
}

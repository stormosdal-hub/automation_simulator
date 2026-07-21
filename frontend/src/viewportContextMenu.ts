import { PointerEventTypes } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
import type { MachineEngine } from './machines/engine';
import type { ProjectStore } from './projectStore';
import type { Selection } from './selection';
import { revealPanel } from './commandPalette';

/** Walk up the mesh's parent chain to the `machine:<id>` root, if any. */
function machineIdFromMesh(mesh: AbstractMesh | null): string | null {
  let node: { name: string; parent: unknown } | null = mesh;
  while (node) {
    if (node.name.startsWith('machine:')) return node.name.split(':')[1] ?? null;
    node = node.parent as { name: string; parent: unknown } | null;
  }
  return null;
}

/**
 * Right-click a machine in the viewport for a small context menu: Move,
 * Rotate, Properties, Remove. Move/Rotate hand off to MachineEngine's gizmos
 * (machineGizmos.ts); Properties selects the machine and reveals the
 * Machines panel; Remove confirms then deletes it. Left-click keeps its
 * existing plain-select behavior (viewportSelection.ts) — this only adds a
 * second, additive interaction on the same meshes.
 */
export function attachMachineContextMenu(
  scene: Scene,
  engine: MachineEngine,
  projectStore: ProjectStore,
  selection: Selection,
): void {
  const canvas = scene.getEngine().getRenderingCanvas();
  const menu = document.createElement('div');
  menu.className = 'machine-ctx-menu';
  menu.dataset.role = 'machine-ctx-menu';
  menu.hidden = true;
  document.body.append(menu);

  let openFor: string | null = null;

  function close(): void {
    menu.hidden = true;
    openFor = null;
  }

  function item(label: string, role: string, onClick: () => void): HTMLButtonElement {
    const el = document.createElement('button');
    el.className = 'machine-ctx-item';
    el.dataset.role = role;
    el.textContent = label;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      onClick();
    });
    return el;
  }

  function open(machineId: string, clientX: number, clientY: number): void {
    const m = projectStore.project.machines?.find((x) => x.id === machineId);
    if (!m) return;
    openFor = machineId;
    menu.innerHTML = '';
    menu.append(
      item('Move', 'machine-ctx-move', () => {
        selection.set(`machine:${machineId}`);
        engine.startMove(machineId);
      }),
      item('Rotate', 'machine-ctx-rotate', () => {
        selection.set(`machine:${machineId}`);
        engine.startRotate(machineId);
      }),
      item('Properties', 'machine-ctx-props', () => {
        selection.set(`machine:${machineId}`);
        revealPanel('machines');
      }),
      item('Remove', 'machine-ctx-remove', () => {
        if (!confirm(`Remove "${m.name}"?`)) return;
        engine.stopGizmo();
        projectStore.removeMachine(machineId);
        if (selection.name === `machine:${machineId}`) selection.set(null);
      }),
    );
    // clamp on-screen so the menu doesn't run off the right/bottom edge
    const maxX = window.innerWidth - 160;
    const maxY = window.innerHeight - 140;
    menu.style.left = `${Math.min(clientX, maxX)}px`;
    menu.style.top = `${Math.min(clientY, maxY)}px`;
    menu.hidden = false;
  }

  canvas?.addEventListener('contextmenu', (e) => e.preventDefault());

  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERDOWN) return;
    const ev = info.event as PointerEvent;
    if (ev.button !== 2) {
      if (!menu.hidden) close();
      return;
    }
    const picked = info.pickInfo?.pickedMesh ?? null;
    const id = machineIdFromMesh(picked);
    if (!id) {
      close();
      return;
    }
    ev.preventDefault();
    open(id, ev.clientX, ev.clientY);
  });

  document.addEventListener('click', () => {
    if (openFor) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      engine.stopGizmo();
    }
  });
}

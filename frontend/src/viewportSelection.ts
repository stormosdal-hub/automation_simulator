import { Color3, HighlightLayer, Mesh, PointerEventTypes } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { Selection } from './selection';

const HIGHLIGHT = Color3.FromHexString('#3d8bff');

/**
 * Tap a mesh in the viewport to select it; the current selection (from the
 * tree or the viewport) glows. Requires the engine to be created with
 * `{ stencil: true }` for HighlightLayer.
 */
export function attachViewportSelection(scene: Scene, selection: Selection): void {
  const layer = new HighlightLayer('selection-highlight', scene);

  selection.onChange((name) => {
    layer.removeAllMeshes();
    if (!name) return;
    const node = scene.getNodeByName(name);
    if (!node) return;
    const meshes = node instanceof Mesh ? [node, ...node.getChildMeshes(false)] : node.getChildMeshes(false);
    for (const mesh of meshes) {
      if (mesh instanceof Mesh) layer.addMesh(mesh, HIGHLIGHT);
    }
  });

  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERTAP) return;
    const picked = info.pickInfo?.pickedMesh;
    if (!picked) return;
    selection.set(picked.name === 'ground' ? null : picked.name);
  });
}

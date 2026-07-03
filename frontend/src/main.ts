import { Engine } from '@babylonjs/core';
import { DEFAULT_GATEWAY_PORT } from '@sim/shared';
import { AlarmsPanel } from './alarmsPanel';
import { BindingEngine } from './bindings/engine';
import { BindingPanel } from './bindingPanel';
import { ConnectionsPanel } from './connectionsPanel';
import { ControlPanels } from './controlPanels';
import { FileMenu } from './fileMenu';
import { Hud } from './hud';
import { OnlineMenu } from './onlineMenu';
import { createPanel } from './panel';
import { ProjectStore } from './projectStore';
import { ReplayPanel } from './replayPanel';
import { createScene } from './scene';
import { SceneTree } from './sceneTree';
import { Selection } from './selection';
import { TagStore } from './tagStore';
import { TagTable } from './tagTable';
import { attachViewportSelection } from './viewportSelection';
import { connectGateway, type WsStatus } from './wsClient';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const store = new TagStore();
const projectStore = new ProjectStore();
new FileMenu(document.getElementById('topbar')!, projectStore);
const selection = new Selection();
const bindingEngine = new BindingEngine(store);
bindingEngine.setBindings(projectStore.project.bindings);
projectStore.onChange(() => bindingEngine.setBindings(projectStore.project.bindings));

// hostname (not localhost) so the page also works when browsed from another machine
const gatewayUrl = `ws://${location.hostname}:${DEFAULT_GATEWAY_PORT}`;
const hud = new Hud(gatewayUrl);

let wsStatus: WsStatus = 'connecting';
const conn = connectGateway(gatewayUrl, store, (status) => {
  wsStatus = status;
  hud.setStatus(status);
});
new OnlineMenu(document.getElementById('topbar')!, store, conn);

const connectionsPanel = createPanel('Connections');
new ConnectionsPanel(connectionsPanel.body, store, () => wsStatus, conn);

const tagsPanel = createPanel('Live tags');
new TagTable(tagsPanel.body, store);

const left = document.getElementById('panels-left')!;
const right = document.getElementById('panels')!;
const treePanel = createPanel('Scene', left);
const sceneTree = new SceneTree(treePanel.body, selection);
const bindingsPanel = createPanel('Bindings', left);
const bindingPanel = new BindingPanel(bindingsPanel.body, {
  projectStore,
  tagStore: store,
  selection,
  engine: bindingEngine,
  nodeNames: () => sceneTree.names(),
});

new ControlPanels(right, { projectStore, store, conn });

const alarmsPanel = new AlarmsPanel(createPanel('Alarms'), projectStore, store);
const replayPanel = new ReplayPanel(createPanel('Record / Replay'), store);

// Engine creation throws where WebGL is unavailable; keep the HUD and tag
// stream alive so the failure is visible instead of a silent blank page.
let engine: Engine | null = null;
try {
  engine = new Engine(canvas, true, { stencil: true });
} catch (err) {
  hud.setScene(`error: ${err instanceof Error ? err.message : String(err)}`);
  console.error(err);
}

if (engine) {
  const eng = engine;
  createScene(eng, canvas, projectStore.project.modelUrl)
    .then((scene) => {
      hud.setScene('loaded');
      bindingEngine.attach(scene);
      sceneTree.setScene(scene);
      attachViewportSelection(scene, selection);
      bindingPanel.refresh();
      // dev/testing hook
      (window as unknown as Record<string, unknown>).__SIM__ = {
        scene,
        store,
        projectStore,
        bindingEngine,
        conn,
        alarmsPanel,
        replayPanel,
      };
      eng.runRenderLoop(() => scene.render());
    })
    .catch((err: Error) => {
      hud.setScene(`error: ${err.message}`);
      console.error(err);
    });
  window.addEventListener('resize', () => eng.resize());
}

import { Engine } from '@babylonjs/core';
import { DEFAULT_GATEWAY_PORT } from '@sim/shared';
import { AlarmsPanel } from './alarmsPanel';
import { BindingEngine } from './bindings/engine';
import { BindingPanel } from './bindingPanel';
import { CommandPalette } from './commandPalette';
import { buildCommandProviders } from './commands';
import { ConnectionsPanel } from './connectionsPanel';
import { ControlPanels } from './controlPanels';
import { FileMenu } from './fileMenu';
import { Hud } from './hud';
import { initLayout } from './layout';
import { MachineEngine } from './machines/engine';
import { MachinePanel } from './machinePanel';
import { OnlineMenu } from './onlineMenu';
import { createPanel } from './panel';
import { panelRegistry } from './panelRegistry';
import { PanelsMenu } from './panelsMenu';
import { ProjectStore } from './projectStore';
import { ReplayPanel } from './replayPanel';
import { createScene } from './scene';
import { SceneTree } from './sceneTree';
import { Selection } from './selection';
import { TagStore } from './tagStore';
import { TagTable } from './tagTable';
import { TrendPanel } from './trendPanel';
import { attachMachineContextMenu } from './viewportContextMenu';
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
new PanelsMenu(document.getElementById('topbar')!);

const connectionsPanel = createPanel('Connections');
new ConnectionsPanel(connectionsPanel.body, store, () => wsStatus, conn);

const tagsPanel = createPanel('Live tags');
new TagTable(tagsPanel.body, store);

const trendsPanel = createPanel('Trends');
new TrendPanel(trendsPanel.body, store);

const left = document.getElementById('panels-left')!;
const right = document.getElementById('panels')!;
const treePanel = createPanel('Scene', left, undefined, { available: false });
const sceneTree = new SceneTree(treePanel.body, selection);
const bindingsPanel = createPanel('Bindings', left, undefined, { available: false });
const bindingPanel = new BindingPanel(bindingsPanel.body, {
  projectStore,
  tagStore: store,
  selection,
  engine: bindingEngine,
  nodeNames: () => sceneTree.names(),
});
// Both panels serve imported GLB models. Machine-library projects have no
// model, so they register as unavailable and the registry keeps them hidden
// (and untogglable in the Panels menu) until a model actually loads.

const machineEngine = new MachineEngine(store, conn, projectStore);
const machinesPanel = createPanel('Machines', left);
new MachinePanel(machinesPanel.body, { projectStore, tagStore: store, engine: machineEngine, selection });

new ControlPanels(right, { projectStore, store, conn });

const alarmsPanel = new AlarmsPanel(createPanel('Alarms'), projectStore, store);
const replayPanel = new ReplayPanel(createPanel('Record / Replay'), store);

// column width drag handles (+ restore persisted widths) — after all panels exist
initLayout();

// command palette (Ctrl/Cmd-K): jump to any panel, machine, tag, preset, action
const commandPalette = new CommandPalette(
  buildCommandProviders({ projectStore, store, selection, engine: machineEngine }),
);

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
    .then(async (scene) => {
      hud.setScene('loaded');
      bindingEngine.attach(scene);
      await machineEngine.attach(scene); // physics world + machine rigs
      sceneTree.setScene(scene);
      attachViewportSelection(scene, selection);
      attachMachineContextMenu(scene, machineEngine, projectStore, selection);
      bindingPanel.refresh();
      if (sceneTree.names().length > 0) {
        panelRegistry.setAvailable(treePanel.id, true);
        panelRegistry.setAvailable(bindingsPanel.id, true);
      }
      // dev/testing hook
      (window as unknown as Record<string, unknown>).__SIM__ = {
        scene,
        store,
        projectStore,
        bindingEngine,
        machineEngine,
        selection,
        conn,
        alarmsPanel,
        replayPanel,
        panelRegistry,
        commandPalette,
      };
      eng.runRenderLoop(() => scene.render());
    })
    .catch((err: Error) => {
      hud.setScene(`error: ${err.message}`);
      console.error(err);
    });
  window.addEventListener('resize', () => eng.resize());
}

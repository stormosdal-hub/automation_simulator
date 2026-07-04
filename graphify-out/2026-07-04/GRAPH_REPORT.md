# Graph Report - automation_sim  (2026-07-04)

## Corpus Check
- 67 files · ~41,210 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 684 nodes · 1255 edges · 42 communities (30 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00ed3cfb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]

## God Nodes (most connected - your core abstractions)
1. `TagStore` - 35 edges
2. `TagMeta` - 32 edges
3. `AdapterMeta` - 27 edges
4. `ProjectStore` - 26 edges
5. `TagBus` - 26 edges
6. `PublishFn` - 25 edges
7. `TagUpdate` - 25 edges
8. `Adapter` - 24 edges
9. `TiaWebAdapter` - 20 edges
10. `div()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `TagBus` --references--> `Tag Write Path (browser → gateway → adapter)`  [EXTRACTED]
  gateway/src/bus.ts → CLAUDE.md
- `TagBus` --references--> `TagBus Pub/Sub Pattern`  [EXTRACTED]
  gateway/src/bus.ts → CLAUDE.md
- `WebSocket Client` --references--> `Tag Write Path (browser → gateway → adapter)`  [EXTRACTED]
  frontend/src/wsClient.ts → CLAUDE.md
- `Frontend Main Entry (main.ts)` --references--> `window.__SIM__ Testing Hook`  [EXTRACTED]
  frontend/src/main.ts → CLAUDE.md
- `TagRow` --references--> `TagMeta`  [EXTRACTED]
  frontend/src/tagStore.ts → shared/src/index.ts

## Import Cycles
- 1-file cycle: `gateway/src/index.ts -> gateway/src/index.ts`

## Hyperedges (group relationships)
- **All Adapter Implementations of Adapter Contract** — adapters_modbus, adapters_opcua, adapters_mqtt, adapters_simulator, gateway_adapter [EXTRACTED 1.00]
- **Tag Write Path Flow: Browser → WS → Bus → Adapter** — frontend_wsclient, gateway_bus, adapters_modbus, adapters_opcua, adapters_mqtt, concept_write_path [EXTRACTED 0.95]
- **Polish Phase Frontend Modules** — frontend_connectionspanel, frontend_alarmspanel, frontend_replaypanel, frontend_ui, frontend_widgets, frontend_controlpanels [EXTRACTED 0.90]

## Communities (42 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (10): ModbusAdapterConfig, ModbusTagConfig, INTEGER_TYPES, OpcUaAdapterConfig, OpcUaTagConfig, 2s Heartbeat for Change-Driven Adapters, Adapter Online Health Tag Convention, Adapter Contract (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.26
Nodes (7): PressAdapter, Adapter, BusListener, TagChangeListener, AdapterMeta, TagMeta, TagUpdate

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (28): Applier, Axis, baselineKey(), BindingEngine, AlarmCondition, applyTransform(), BINDABLE_PROPERTIES, Binding (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (28): Deps, Hud, ColumnSpec, initLayout(), alarmsPanel, bindingEngine, bindingPanel, bindingsPanel (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (30): dependencies, modbus-serial, mqtt, node-opcua, nodes7, @sim/shared, ws, devDependencies (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (19): window.__SIM__ Testing Hook, Tag Write Path (browser → gateway → adapter), Alarms Panel, Connections Panel, Control Panels Manager, Frontend index.html, Frontend Main Entry (main.ts), Panel Manager (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (5): initial, PORT, require, server, snap7

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (16): dependencies, @babylonjs/core, @babylonjs/loaders, @sim/shared, devDependencies, typescript, vite, name (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (15): bin, binChunk, FACES, gltf, idxBuf, indices, jsonChunk, jsonRaw (+7 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (10): devDependencies, concurrently, name, private, scripts, dev, glb, typecheck (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (6): mixer, ns, { OPCUAServer, Variant, DataType, StatusCodes, MessageSecurityMode, SecurityPolicy }, PORT, require, server

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (6): dependencies, @modelcontextprotocol/sdk, main, name, type, version

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (5): ModbusRTU, PORT, require, server, vector

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (6): exports, name, private, type, types, version

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (4): __dirname, server, transport, VAULT

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (3): client, mqtt, require

### Community 25 - "Community 25"
Cohesion: 0.06
Nodes (34): 10. Command cheat-sheet, 1. Prerequisites & repo layout, 2. Get a PLC program running, 3. Choose a path, 4. Point the gateway at the runtime, 5. Start everything, 6. Verify the link, 7. Close the loop — no hardware, ever (+26 more)

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (4): Architecture, Automation Sim — agent guide, Commands, Environment notes

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (15): ConveyorAdapterConfig, MixerAdapterConfig, PressAdapterConfig, S7AdapterConfig, S7TagConfig, AdapterConfigEntry, CONFIG_URL, GatewayConfig (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (9): latest, main(), ok(), project, results, sleep(), waitFor(), write() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.06
Nodes (27): alarmActive(), AlarmsPanel, formatDuration(), ConnectionsPanel, RefreshState, HelloMessage, labeled(), normalizeUrl() (+19 more)

### Community 31 - "Community 31"
Cohesion: 0.06
Nodes (28): AlarmRule, ControlPanelDef, Project, Widget, widgetAcceptsTag(), WidgetType, ControlPanels, Deps (+20 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (9): latest, main(), ok(), project, results, sleep(), waitFor(), write() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.21
Nodes (6): coerce(), MqttAdapter, MqttAdapterConfig, MqttTagConfig, walkPath(), PublishFn

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (7): DiscoveredTag, discoverTags(), Discovery, TiaState, TiaWebAdapter, TiaWebTagConfig, AdapterContext

### Community 36 - "Community 36"
Cohesion: 0.39
Nodes (8): latest, main(), ok(), results, sleep(), waitFor(), write(), ws

### Community 40 - "Community 40"
Cohesion: 0.09
Nodes (22): TiaWebAdapterConfig, AdapterRemovedMessage, ClientMessage, ConnectTiaMessage, GatewayMessage, RefreshTagsMessage, RemoveTiaMessage, TagsChangedMessage (+14 more)

## Knowledge Gaps
- **242 isolated node(s):** `node`, `name`, `version`, `type`, `main` (+237 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AdapterMeta` connect `Community 1` to `Community 0`, `Community 33`, `Community 34`, `Community 35`, `Community 37`, `Community 38`, `Community 7`, `Community 40`, `Community 13`, `Community 28`, `Community 30`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `TagStore` connect `Community 30` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 41`, `Community 31`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `TagMeta` connect `Community 1` to `Community 0`, `Community 33`, `Community 34`, `Community 35`, `Community 37`, `Community 38`, `Community 7`, `Community 40`, `Community 39`, `Community 13`, `Community 28`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TagBus` (e.g. with `simulator.ts` and `WebSocket Client`) actually correct?**
  _`TagBus` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `node`, `name`, `version` to the rest of the system?**
  _243 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09565217391304348 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05851063829787234 - nodes in this community are weakly interconnected._
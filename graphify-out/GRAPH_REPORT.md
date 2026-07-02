# Graph Report - automation_sim  (2026-07-02)

## Corpus Check
- 52 files · ~20,665 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 487 nodes · 868 edges · 28 communities (22 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1654221e`
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

## God Nodes (most connected - your core abstractions)
1. `TagStore` - 29 edges
2. `ProjectStore` - 24 edges
3. `TagBus` - 20 edges
4. `TagMeta` - 19 edges
5. `ModbusAdapter` - 18 edges
6. `AdapterMeta` - 17 edges
7. `TagUpdate` - 17 edges
8. `PublishFn` - 16 edges
9. `Adapter` - 16 edges
10. `S7Adapter` - 16 edges

## Surprising Connections (you probably didn't know these)
- `WebSocket Client` --references--> `Tag Write Path (browser → gateway → adapter)`  [EXTRACTED]
  frontend/src/wsClient.ts → CLAUDE.md
- `TagBus` --references--> `TagBus Pub/Sub Pattern`  [EXTRACTED]
  gateway/src/bus.ts → CLAUDE.md
- `TagBus` --references--> `Tag Write Path (browser → gateway → adapter)`  [EXTRACTED]
  gateway/src/bus.ts → CLAUDE.md
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

## Communities (28 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (34): ModbusAdapterConfig, ModbusTagConfig, coerce(), MqttAdapter, MqttAdapterConfig, MqttTagConfig, walkPath(), INTEGER_TYPES (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (32): Deps, ConnectionsPanel, Hud, ClientMessage, GatewayMessage, TagUpdateMessage, WriteErrorMessage, WriteMessage (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (28): Applier, Axis, baselineKey(), BindingEngine, AlarmCondition, applyTransform(), BINDABLE_PROPERTIES, Binding (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (19): alarmActive(), AlarmsPanel, formatDuration(), HelloMessage, createPanel(), Panel, formatMs(), RecordedEvent (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (25): AlarmRule, ControlPanelDef, Project, Widget, widgetAcceptsTag(), WidgetType, ControlPanels, Deps (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): dependencies, modbus-serial, mqtt, node-opcua, nodes7, @sim/shared, ws, devDependencies (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (18): window.__SIM__ Testing Hook, Alarms Panel, Connections Panel, Control Panels Manager, Frontend index.html, Frontend Main Entry (main.ts), Panel Manager, Project Store (localStorage + defaults) (+10 more)

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
Cohesion: 0.40
Nodes (4): Automation Sim, Layout, Roadmap, Run

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (4): Architecture, Automation Sim — agent guide, Commands, Environment notes

## Knowledge Gaps
- **176 isolated node(s):** `node`, `name`, `version`, `type`, `main` (+171 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TagStore` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 4`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `AdapterMeta` connect `Community 0` to `Community 1`, `Community 3`, `Community 13`, `Community 7`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `TagUpdate` connect `Community 0` to `Community 1`, `Community 3`, `Community 13`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TagBus` (e.g. with `simulator.ts` and `WebSocket Client`) actually correct?**
  _`TagBus` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `node`, `name`, `version` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05194805194805195 - nodes in this community are weakly interconnected._
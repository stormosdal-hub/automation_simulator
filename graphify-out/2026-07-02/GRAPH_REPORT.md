# Graph Report - automation_sim  (2026-07-02)

## Corpus Check
- 45 files · ~18,536 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 418 nodes · 770 edges · 22 communities (20 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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

## God Nodes (most connected - your core abstractions)
1. `TagStore` - 33 edges
2. `ProjectStore` - 24 edges
3. `TagMeta` - 19 edges
4. `ModbusAdapter` - 18 edges
5. `TagUpdate` - 16 edges
6. `OpcUaAdapter` - 15 edges
7. `AdapterMeta` - 15 edges
8. `ReplayPanel` - 14 edges
9. `Adapter` - 14 edges
10. `BindingEngine` - 13 edges

## Surprising Connections (you probably didn't know these)
- `TagRow` --references--> `TagMeta`  [EXTRACTED]
  frontend/src/tagStore.ts → shared/src/index.ts
- `TagStore` --references--> `AdapterMeta`  [EXTRACTED]
  frontend/src/tagStore.ts → shared/src/index.ts
- `TagStore` --references--> `TagMeta`  [EXTRACTED]
  frontend/src/tagStore.ts → shared/src/index.ts
- `TagStore` --references--> `TagUpdate`  [EXTRACTED]
  frontend/src/tagStore.ts → shared/src/index.ts
- `ModbusAdapter` --references--> `AdapterMeta`  [EXTRACTED]
  gateway/src/adapters/modbus.ts → shared/src/index.ts

## Import Cycles
- 1-file cycle: `gateway/src/index.ts -> gateway/src/index.ts`

## Communities (22 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (23): ConnectionsPanel, Hud, HelloMessage, alarmsPanel, bindingEngine, bindingPanel, bindingsPanel, canvas (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (23): dependencies, modbus-serial, mqtt, node-opcua, @sim/shared, ws, devDependencies, tsx (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (16): dependencies, @babylonjs/core, @babylonjs/loaders, @sim/shared, devDependencies, typescript, vite, name (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (15): bin, binChunk, FACES, gltf, idxBuf, indices, jsonChunk, jsonRaw (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (31): ModbusAdapterConfig, ModbusTagConfig, coerce(), MqttAdapter, MqttAdapterConfig, MqttTagConfig, walkPath(), INTEGER_TYPES (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (10): devDependencies, concurrently, name, private, scripts, dev, glb, typecheck (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (6): exports, name, private, type, types, version

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (4): Automation Sim, Layout, Roadmap, Run

### Community 12 - "Community 12"
Cohesion: 0.40
Nodes (4): Architecture, Automation Sim — agent guide, Commands, Environment notes

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (25): Applier, Axis, baselineKey(), BindingEngine, applyTransform(), BINDABLE_PROPERTIES, Binding, BindingProperty (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (6): Deps, SceneTree, TreeRow, Selection, attachViewportSelection(), HIGHLIGHT

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (5): AlarmRule, Project, Widget, DEFAULT_PROJECT, ProjectStore

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (21): ControlPanelDef, widgetAcceptsTag(), WidgetType, ControlPanels, Deps, WIDGET_TYPES, createPanel(), newBindingId() (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (5): ModbusRTU, PORT, require, server, vector

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (6): mixer, ns, { OPCUAServer, Variant, DataType, StatusCodes, MessageSecurityMode, SecurityPolicy }, PORT, require, server

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (15): alarmActive(), AlarmCondition, AlarmsPanel, formatDuration(), Panel, formatMs(), RecordedEvent, Recording (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): client, mqtt, require

## Knowledge Gaps
- **146 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TagStore` connect `Community 0` to `Community 6`, `Community 13`, `Community 14`, `Community 16`, `Community 20`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `TagMeta` connect `Community 6` to `Community 0`, `Community 16`, `Community 18`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `AdapterMeta` connect `Community 6` to `Community 0`, `Community 18`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07342995169082125 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
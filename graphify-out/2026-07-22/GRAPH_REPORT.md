# Graph Report - automation_sim  (2026-07-22)

## Corpus Check
- 89 files · ~69,599 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 940 nodes · 1925 edges · 65 communities (41 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `45619197`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Binding Engine & Transform Application|Binding Engine & Transform Application]]
- [[_COMMUNITY_Physics Parts Manager (BoxManager)|Physics Parts Manager (BoxManager)]]
- [[_COMMUNITY_Protocol Adapter Configs (ModbusMQTTConveyorMixer)|Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)]]
- [[_COMMUNITY_Project File Menu & SaveLoad|Project File Menu & Save/Load]]
- [[_COMMUNITY_TIA Web Practice Integration Guide|TIA Web Practice Integration Guide]]
- [[_COMMUNITY_Gateway Dependencies (ModbusMQTTOPC-UAS7 clients)|Gateway Dependencies (Modbus/MQTT/OPC-UA/S7 clients)]]
- [[_COMMUNITY_Gateway WS Message Types & Index|Gateway WS Message Types & Index]]
- [[_COMMUNITY_Connections Panel & Adapter Health|Connections Panel & Adapter Health]]
- [[_COMMUNITY_Machine Engine Core (draggrabphysics tick)|Machine Engine Core (drag/grab/physics tick)]]
- [[_COMMUNITY_Panel Layout & Column Resize|Panel Layout & Column Resize]]
- [[_COMMUNITY_Adapter Config Type Declarations|Adapter Config Type Declarations]]
- [[_COMMUNITY_Bindings Types & Gateway Config Rationale|Bindings Types & Gateway Config Rationale]]
- [[_COMMUNITY_TagBus Core (registerrefreshwrite)|TagBus Core (register/refresh/write)]]
- [[_COMMUNITY_Alarms Evaluation & Panel|Alarms Evaluation & Panel]]
- [[_COMMUNITY_Control Panel Widgets & Definitions|Control Panel Widgets & Definitions]]
- [[_COMMUNITY_CLAUDE.md Architecture Notes (MQTTModbus rationale)|CLAUDE.md Architecture Notes (MQTT/Modbus rationale)]]
- [[_COMMUNITY_TIA Web Adapter Tag Discovery|TIA Web Adapter Tag Discovery]]
- [[_COMMUNITY_Frontend Dependencies (Babylon.jsHavok)|Frontend Dependencies (Babylon.js/Havok)]]
- [[_COMMUNITY_Machine Engine Tag IO (EngineIO)|Machine Engine Tag IO (EngineIO)]]
- [[_COMMUNITY_Command Palette Core|Command Palette Core]]
- [[_COMMUNITY_Online Menu (TIA Connection Manager UI)|Online Menu (TIA Connection Manager UI)]]
- [[_COMMUNITY_Mixer Machine Model Adapter|Mixer Machine Model Adapter]]
- [[_COMMUNITY_Frontend tsconfig|Frontend tsconfig]]
- [[_COMMUNITY_Gateway tsconfig|Gateway tsconfig]]
- [[_COMMUNITY_Root Package Scripts & Test Deps|Root Package Scripts & Test Deps]]
- [[_COMMUNITY_Machines Panel UI|Machines Panel UI]]
- [[_COMMUNITY_Replay Panel|Replay Panel]]
- [[_COMMUNITY_Modbus TCP Adapter|Modbus TCP Adapter]]
- [[_COMMUNITY_Machine Catalog & Types|Machine Catalog & Types]]
- [[_COMMUNITY_Conveyor Loop Integration Probe|Conveyor Loop Integration Probe]]
- [[_COMMUNITY_TIA Web Adapter Probe|TIA Web Adapter Probe]]
- [[_COMMUNITY_S7 (Siemens) Adapter|S7 (Siemens) Adapter]]
- [[_COMMUNITY_FluidNet (TankPumpValve Simulation)|FluidNet (Tank/Pump/Valve Simulation)]]
- [[_COMMUNITY_Machine MoveRotate Gizmos|Machine Move/Rotate Gizmos]]
- [[_COMMUNITY_Panel Registry (Visibility & Workspace Presets)|Panel Registry (Visibility & Workspace Presets)]]
- [[_COMMUNITY_OPC UA Adapter|OPC UA Adapter]]
- [[_COMMUNITY_Command Palette UI Component|Command Palette UI Component]]
- [[_COMMUNITY_MQTT Adapter|MQTT Adapter]]
- [[_COMMUNITY_Machines Smoke-Test Probe|Machines Smoke-Test Probe]]
- [[_COMMUNITY_OPC UA Server Simulator Script|OPC UA Server Simulator Script]]
- [[_COMMUNITY_Conveyor Machine Model Adapter|Conveyor Machine Model Adapter]]
- [[_COMMUNITY_Memory (Virtual Tags) Adapter|Memory (Virtual Tags) Adapter]]
- [[_COMMUNITY_MCP Server Dependencies|MCP Server Dependencies]]
- [[_COMMUNITY_Modbus PLC Simulator Script|Modbus PLC Simulator Script]]
- [[_COMMUNITY_Shared Package Manifest|Shared Package Manifest]]
- [[_COMMUNITY_HUD Status Overlay|HUD Status Overlay]]
- [[_COMMUNITY_Connections Panel Rationale (HeartbeatLWT)|Connections Panel Rationale (Heartbeat/LWT)]]
- [[_COMMUNITY_S7 PLC Simulator Script|S7 PLC Simulator Script]]
- [[_COMMUNITY_MCP Server Implementation|MCP Server Implementation]]
- [[_COMMUNITY_MQTT Device Simulator Script|MQTT Device Simulator Script]]
- [[_COMMUNITY_MCP Config|MCP Config]]
- [[_COMMUNITY_Gateway Smoke-Test Probe|Gateway Smoke-Test Probe]]
- [[_COMMUNITY_nodes7 Type Declarations|nodes7 Type Declarations]]
- [[_COMMUNITY_Alarms Panel (doc node)|Alarms Panel (doc node)]]
- [[_COMMUNITY_Binding Panel (doc node)|Binding Panel (doc node)]]
- [[_COMMUNITY_Frontend index.html (doc node)|Frontend index.html (doc node)]]
- [[_COMMUNITY_Replay Panel (doc node)|Replay Panel (doc node)]]
- [[_COMMUNITY_Scene Tree (doc node)|Scene Tree (doc node)]]
- [[_COMMUNITY_Tag Table (doc node)|Tag Table (doc node)]]
- [[_COMMUNITY_Shared DOM Builders (doc node)|Shared DOM Builders (doc node)]]
- [[_COMMUNITY_Viewport Selection (doc node)|Viewport Selection (doc node)]]
- [[_COMMUNITY_Widget Library (doc node)|Widget Library (doc node)]]
- [[_COMMUNITY_Gateway Config (doc node)|Gateway Config (doc node)]]

## God Nodes (most connected - your core abstractions)
1. `Automation Sim — Agent Guide (CLAUDE.md)` - 49 edges
2. `TagStore` - 44 edges
3. `MachineEngine` - 41 edges
4. `Automation Sim README` - 41 edges
5. `ProjectStore` - 37 edges
6. `TagMeta` - 35 edges
7. `PublishFn` - 29 edges
8. `AdapterMeta` - 28 edges
9. `TagUpdate` - 28 edges
10. `div()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Automation Sim — Agent Guide (CLAUDE.md)` --references--> `AlarmsPanel`  [EXTRACTED]
  CLAUDE.md → frontend/src/alarmsPanel.ts
- `Automation Sim README` --references--> `AlarmsPanel`  [EXTRACTED]
  README.md → frontend/src/alarmsPanel.ts
- `Automation Sim — Agent Guide (CLAUDE.md)` --references--> `BindingEngine`  [EXTRACTED]
  CLAUDE.md → frontend/src/bindings/engine.ts
- `Automation Sim README` --references--> `BindingEngine`  [EXTRACTED]
  README.md → frontend/src/bindings/engine.ts
- `Automation Sim — Agent Guide (CLAUDE.md)` --references--> `ConnectionsPanel`  [EXTRACTED]
  CLAUDE.md → frontend/src/connectionsPanel.ts

## Import Cycles
- 1-file cycle: `gateway/src/index.ts -> gateway/src/index.ts`

## Hyperedges (group relationships)
- **Adapter Contract Implementers** — src_adapter_adaptercontract, adapters_modbus_modbusadapter, adapters_opcua_opcuaadapter, adapters_mqtt_mqttadapter, adapters_s7_s7adapter, adapters_simulator_simulatoradapter [EXTRACTED 1.00]
- **Local Device Simulator Suite** — scripts_modbus_plc_sim_modbusplcsim, scripts_opcua_server_sim_opcuaserversim, scripts_mqtt_device_sim_mqttdevicesim, scripts_s7_plc_sim_s7plcsim [EXTRACTED 1.00]
- **window.__SIM__ Testing Surface** — claude_window_sim, src_projectstore_projectstore, bindings_engine_bindingengine, src_alarmspanel_alarmspanel, src_replaypanel_replaypanel [EXTRACTED 1.00]

## Communities (65 total, 24 thin omitted)

### Community 0 - "Binding Engine & Transform Application"
Cohesion: 0.12
Nodes (25): Applier, Axis, AlarmCondition, AlarmRule, applyTransform(), BINDABLE_PROPERTIES, Binding, BindingProperty (+17 more)

### Community 1 - "Physics Parts Manager (BoxManager)"
Cohesion: 0.14
Nodes (35): BoxManager, BoxPart, PALETTE, PartShape, animatedBody(), dynamicBody(), initScenePhysics(), physicsReady() (+27 more)

### Community 2 - "Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)"
Cohesion: 0.33
Nodes (4): SimulatorAdapter, Adapter, AdapterMeta, TagMeta

### Community 3 - "Project File Menu & Save/Load"
Cohesion: 0.05
Nodes (31): Project, Deps, GizmoMode, MachineGizmos, Rig, MACHINE_CATALOG, machineDef, MachineInstance (+23 more)

### Community 4 - "TIA Web Practice Integration Guide"
Cohesion: 0.06
Nodes (30): 10. Command cheat-sheet, 1. Prerequisites & repo layout, 2. Get a PLC program running, 3. Choose a path, 4. Point the gateway at the runtime, 5. Start everything, 6. Verify the link, 7. Close the loop — no hardware, ever (+22 more)

### Community 5 - "Gateway Dependencies (Modbus/MQTT/OPC-UA/S7 clients)"
Cohesion: 0.06
Nodes (30): dependencies, modbus-serial, mqtt, node-opcua, nodes7, @sim/shared, ws, devDependencies (+22 more)

### Community 6 - "Gateway WS Message Types & Index"
Cohesion: 0.07
Nodes (29): AdapterRemovedMessage, ClientMessage, ConnectTiaMessage, GatewayMessage, RefreshTagsMessage, RemoveTiaMessage, ScanHit, ScanResultMessage (+21 more)

### Community 7 - "Connections Panel & Adapter Health"
Cohesion: 0.14
Nodes (5): Deps, HelloMessage, TagStore, Deps, GatewayConnection

### Community 9 - "Panel Layout & Column Resize"
Cohesion: 0.08
Nodes (25): buildCommandProviders(), ColumnSpec, initLayout(), alarmsPanel, bindingEngine, bindingPanel, bindingsPanel, canvas (+17 more)

### Community 10 - "Adapter Config Type Declarations"
Cohesion: 0.13
Nodes (17): ConveyorAdapterConfig, MixerAdapterConfig, ModbusAdapterConfig, ModbusTagConfig, INTEGER_TYPES, OpcUaAdapterConfig, OpcUaTagConfig, PressAdapterConfig (+9 more)

### Community 11 - "Bindings Types & Gateway Config Rationale"
Cohesion: 0.33
Nodes (6): Gateway Port 8082 Choice, Node.js Gateway (protocol normalization service), Modbus TCP, MQTT, OPC UA, S7comm (Siemens ISO-on-TCP)

### Community 12 - "TagBus Core (register/refresh/write)"
Cohesion: 0.13
Nodes (6): BusListener, TagBus, TagChangeListener, GatewayConfig, LinkConfig, startLinks()

### Community 13 - "Alarms Evaluation & Panel"
Cohesion: 0.05
Nodes (27): alarmActive(), AlarmsPanel, formatDuration(), RefreshState, formRow(), download(), FileMenu, isProject() (+19 more)

### Community 14 - "Control Panel Widgets & Definitions"
Cohesion: 0.06
Nodes (30): ControlPanelDef, Widget, widgetAcceptsTag(), WidgetType, ControlPanels, WIDGET_TYPES, createPanel(), Panel (+22 more)

### Community 15 - "CLAUDE.md Architecture Notes (MQTT/Modbus rationale)"
Cohesion: 0.11
Nodes (28): frontend/src/bindings/types.ts — Binding/TransformSpec/Project types, Automation Sim — Agent Guide (CLAUDE.md), modbus-serial (npm Modbus client), mosquitto (system MQTT broker), mqtt.js, node-opcua, node-snap7 (native dev dependency), nodes7 (pure-JS S7 client) (+20 more)

### Community 16 - "TIA Web Adapter Tag Discovery"
Cohesion: 0.14
Nodes (8): DiscoveredTag, discoverTags(), Discovery, TiaState, TiaWebAdapter, TiaWebAdapterConfig, TiaWebTagConfig, AdapterContext

### Community 17 - "Frontend Dependencies (Babylon.js/Havok)"
Cohesion: 0.11
Nodes (17): dependencies, @babylonjs/core, @babylonjs/havok, @babylonjs/loaders, @sim/shared, devDependencies, typescript, vite (+9 more)

### Community 19 - "Command Palette Core"
Cohesion: 0.33
Nodes (3): baselineKey(), BindingEngine, Binding Baseline Capture & Restore

### Community 20 - "Online Menu (TIA Connection Manager UI)"
Cohesion: 0.29
Nodes (7): Automation Sim, Babylon.js, Browser Frontend (Vite + TypeScript + Babylon.js), Layout, Roadmap, Run, The machine library (Machines panel, left column)

### Community 21 - "Mixer Machine Model Adapter"
Cohesion: 0.13
Nodes (3): MixerAdapter, PressAdapter, TagUpdate

### Community 22 - "Frontend tsconfig"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 23 - "Gateway tsconfig"
Cohesion: 0.14
Nodes (13): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 24 - "Root Package Scripts & Test Deps"
Cohesion: 0.14
Nodes (13): devDependencies, concurrently, jsdom, vitest, name, private, scripts, dev (+5 more)

### Community 28 - "Machine Catalog & Types"
Cohesion: 0.40
Nodes (4): coerce(), MqttAdapterConfig, MqttTagConfig, walkPath()

### Community 29 - "Conveyor Loop Integration Probe"
Cohesion: 0.22
Nodes (9): latest, main(), ok(), project, results, sleep(), waitFor(), write() (+1 more)

### Community 30 - "TIA Web Adapter Probe"
Cohesion: 0.23
Nodes (9): latest, main(), ok(), project, results, sleep(), waitFor(), write() (+1 more)

### Community 31 - "S7 (Siemens) Adapter"
Cohesion: 0.19
Nodes (3): S7Adapter, Modbus Client Serialization Queue, Fresh NodeS7 Instance Per Connect

### Community 33 - "Machine Move/Rotate Gizmos"
Cohesion: 0.33
Nodes (5): Architecture, Automation Sim — agent guide, Commands, Environment notes, Testing

### Community 40 - "MQTT Adapter"
Cohesion: 0.20
Nodes (6): MqttAdapter, 2s Heartbeat Republish for Change-Driven Publishing, MQTT Command/State Topic Split, Write Path Confirmation Pattern, MQTT LWT Device Liveness, gateway/src/adapter.ts — Adapter contract

### Community 41 - "Machines Smoke-Test Probe"
Cohesion: 0.39
Nodes (8): latest, main(), ok(), results, sleep(), waitFor(), write(), ws

### Community 42 - "OPC UA Server Simulator Script"
Cohesion: 0.25
Nodes (6): mixer, ns, { OPCUAServer, Variant, DataType, StatusCodes, MessageSecurityMode, SecurityPolicy }, PORT, require, server

### Community 44 - "Memory (Virtual Tags) Adapter"
Cohesion: 0.24
Nodes (4): MemoryAdapter, MemoryAdapterConfig, MemoryTagConfig, PublishFn

### Community 45 - "MCP Server Dependencies"
Cohesion: 0.29
Nodes (6): dependencies, @modelcontextprotocol/sdk, main, name, type, version

### Community 46 - "Modbus PLC Simulator Script"
Cohesion: 0.29
Nodes (5): ModbusRTU, PORT, require, server, vector

### Community 47 - "Shared Package Manifest"
Cohesion: 0.29
Nodes (6): exports, name, private, type, types, version

### Community 48 - "HUD Status Overlay"
Cohesion: 0.31
Nodes (4): Hud, connectGateway(), STRUCTURAL_TYPES, WsStatus

### Community 50 - "S7 PLC Simulator Script"
Cohesion: 0.33
Nodes (5): initial, PORT, require, server, snap7

### Community 52 - "MCP Server Implementation"
Cohesion: 0.40
Nodes (4): __dirname, server, transport, VAULT

### Community 53 - "MQTT Device Simulator Script"
Cohesion: 0.40
Nodes (3): client, mqtt, require

## Knowledge Gaps
- **262 isolated node(s):** `node`, `name`, `version`, `type`, `main` (+257 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Automation Sim README` connect `CLAUDE.md Architecture Notes (MQTT/Modbus rationale)` to `Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)`, `Project File Menu & Save/Load`, `OPC UA Adapter`, `Panel Registry (Visibility & Workspace Presets)`, `Connections Panel & Adapter Health`, `MQTT Adapter`, `Bindings Types & Gateway Config Rationale`, `TagBus Core (register/refresh/write)`, `Alarms Evaluation & Panel`, `Connections Panel Rationale (Heartbeat/LWT)`, `Command Palette Core`, `Online Menu (TIA Connection Manager UI)`, `Machines Panel UI`, `Replay Panel`, `Modbus TCP Adapter`, `S7 (Siemens) Adapter`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `TagStore` connect `Connections Panel & Adapter Health` to `Binding Engine & Transform Application`, `Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)`, `Project File Menu & Save/Load`, `Panel Registry (Visibility & Workspace Presets)`, `Panel Layout & Column Resize`, `Alarms Evaluation & Panel`, `Control Panel Widgets & Definitions`, `CLAUDE.md Architecture Notes (MQTT/Modbus rationale)`, `HUD Status Overlay`, `Connections Panel Rationale (Heartbeat/LWT)`, `Mixer Machine Model Adapter`, `Replay Panel`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `Automation Sim — Agent Guide (CLAUDE.md)` connect `CLAUDE.md Architecture Notes (MQTT/Modbus rationale)` to `Panel Registry (Visibility & Workspace Presets)`, `Project File Menu & Save/Load`, `OPC UA Adapter`, `Connections Panel & Adapter Health`, `MQTT Adapter`, `Bindings Types & Gateway Config Rationale`, `TagBus Core (register/refresh/write)`, `Alarms Evaluation & Panel`, `Control Panel Widgets & Definitions`, `Connections Panel Rationale (Heartbeat/LWT)`, `Command Palette Core`, `Online Menu (TIA Connection Manager UI)`, `Machines Panel UI`, `Replay Panel`, `Modbus TCP Adapter`, `S7 (Siemens) Adapter`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `node`, `name`, `version` to the rest of the system?**
  _262 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Binding Engine & Transform Application` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._
- **Should `Physics Parts Manager (BoxManager)` be split into smaller, more focused modules?**
  _Cohesion score 0.13876040703052728 - nodes in this community are weakly interconnected._
- **Should `Project File Menu & Save/Load` be split into smaller, more focused modules?**
  _Cohesion score 0.051929824561403506 - nodes in this community are weakly interconnected._
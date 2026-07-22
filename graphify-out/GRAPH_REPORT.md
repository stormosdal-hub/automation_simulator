# Graph Report - .  (2026-07-22)

## Corpus Check
- 67 files · ~69,184 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 929 nodes · 1849 edges · 71 communities (41 shown, 30 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Trend Panel Charting|Trend Panel Charting]]
- [[_COMMUNITY_OPC UA Adapter|OPC UA Adapter]]
- [[_COMMUNITY_Panel Registry & Panels Menu Types|Panel Registry & Panels Menu Types]]
- [[_COMMUNITY_Command Palette UI Component|Command Palette UI Component]]
- [[_COMMUNITY_Control Panel Widget Builders|Control Panel Widget Builders]]
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
- [[_COMMUNITY_Machine Drag & Snap Helpers|Machine Drag & Snap Helpers]]
- [[_COMMUNITY_MCP Server Implementation|MCP Server Implementation]]
- [[_COMMUNITY_MQTT Device Simulator Script|MQTT Device Simulator Script]]
- [[_COMMUNITY_Trend Panel Data Sampling|Trend Panel Data Sampling]]
- [[_COMMUNITY_Panel Registry Unit Tests|Panel Registry Unit Tests]]
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
10. `Adapter` - 27 edges

## Surprising Connections (you probably didn't know these)
- `MQTT Command/State Topic Split` --rationale_for--> `MqttAdapter`  [EXTRACTED]
  CLAUDE.md → gateway/src/adapters/mqtt.ts
- `Automation Sim — Agent Guide (CLAUDE.md)` --references--> `AlarmsPanel`  [EXTRACTED]
  CLAUDE.md → frontend/src/alarmsPanel.ts
- `Automation Sim README` --references--> `AlarmsPanel`  [EXTRACTED]
  README.md → frontend/src/alarmsPanel.ts
- `Automation Sim — Agent Guide (CLAUDE.md)` --references--> `BindingEngine`  [EXTRACTED]
  CLAUDE.md → frontend/src/bindings/engine.ts
- `Binding Baseline Capture & Restore` --rationale_for--> `BindingEngine`  [EXTRACTED]
  CLAUDE.md → frontend/src/bindings/engine.ts

## Import Cycles
- 1-file cycle: `gateway/src/index.ts -> gateway/src/index.ts`

## Hyperedges (group relationships)
- **Adapter Contract Implementers** — src_adapter_adaptercontract, adapters_modbus_modbusadapter, adapters_opcua_opcuaadapter, adapters_mqtt_mqttadapter, adapters_s7_s7adapter, adapters_simulator_simulatoradapter [EXTRACTED 1.00]
- **Local Device Simulator Suite** — scripts_modbus_plc_sim_modbusplcsim, scripts_opcua_server_sim_opcuaserversim, scripts_mqtt_device_sim_mqttdevicesim, scripts_s7_plc_sim_s7plcsim [EXTRACTED 1.00]
- **window.__SIM__ Testing Surface** — claude_window_sim, src_projectstore_projectstore, bindings_engine_bindingengine, src_alarmspanel_alarmspanel, src_replaypanel_replaypanel [EXTRACTED 1.00]

## Communities (71 total, 30 thin omitted)

### Community 0 - "Binding Engine & Transform Application"
Cohesion: 0.06
Nodes (33): Applier, Axis, baselineKey(), BindingEngine, AlarmCondition, AlarmRule, applyTransform(), BINDABLE_PROPERTIES (+25 more)

### Community 1 - "Physics Parts Manager (BoxManager)"
Cohesion: 0.14
Nodes (35): BoxManager, BoxPart, PALETTE, PartShape, animatedBody(), dynamicBody(), initScenePhysics(), physicsReady() (+27 more)

### Community 2 - "Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)"
Cohesion: 0.18
Nodes (14): ModbusTagConfig, MqttTagConfig, INTEGER_TYPES, OpcUaAdapterConfig, OpcUaTagConfig, PressAdapter, S7TagConfig, Adapter (+6 more)

### Community 3 - "Project File Menu & Save/Load"
Cohesion: 0.10
Nodes (7): Project, download(), FileMenu, isProject(), SAMPLES, slugify(), ProjectStore

### Community 4 - "TIA Web Practice Integration Guide"
Cohesion: 0.06
Nodes (30): 10. Command cheat-sheet, 1. Prerequisites & repo layout, 2. Get a PLC program running, 3. Choose a path, 4. Point the gateway at the runtime, 5. Start everything, 6. Verify the link, 7. Close the loop — no hardware, ever (+22 more)

### Community 5 - "Gateway Dependencies (Modbus/MQTT/OPC-UA/S7 clients)"
Cohesion: 0.06
Nodes (30): dependencies, modbus-serial, mqtt, node-opcua, nodes7, @sim/shared, ws, devDependencies (+22 more)

### Community 6 - "Gateway WS Message Types & Index"
Cohesion: 0.08
Nodes (25): AdapterRemovedMessage, ClientMessage, ConnectTiaMessage, GatewayMessage, RefreshTagsMessage, RemoveTiaMessage, ScanHit, ScanResultMessage (+17 more)

### Community 7 - "Connections Panel & Adapter Health"
Cohesion: 0.10
Nodes (11): RefreshState, Deps, HelloMessage, Deps, TagRow, TagStore, TagValue, TagTable (+3 more)

### Community 9 - "Panel Layout & Column Resize"
Cohesion: 0.08
Nodes (23): ColumnSpec, initLayout(), alarmsPanel, bindingEngine, bindingPanel, bindingsPanel, canvas, commandPalette (+15 more)

### Community 10 - "Adapter Config Type Declarations"
Cohesion: 0.11
Nodes (18): ConveyorAdapterConfig, MemoryAdapterConfig, MemoryTagConfig, MixerAdapterConfig, ModbusAdapterConfig, MqttAdapterConfig, PressAdapterConfig, S7AdapterConfig (+10 more)

### Community 11 - "Bindings Types & Gateway Config Rationale"
Cohesion: 0.11
Nodes (24): frontend/src/bindings/types.ts — Binding/TransformSpec/Project types, Binding Baseline Capture & Restore, Gateway Port 8082 Choice, nodes7 (pure-JS S7 client), gateway/config.json — adapter instance declarations, frontend/public/models/demo-arm.glb — demo arm 3D model, Automation Sim (Project), Babylon.js (+16 more)

### Community 12 - "TagBus Core (register/refresh/write)"
Cohesion: 0.12
Nodes (6): TiaWebAdapterConfig, TagBus, normalize(), probeTia(), TiaConnectionManager, TiaProbeResult

### Community 13 - "Alarms Evaluation & Panel"
Cohesion: 0.19
Nodes (12): alarmActive(), AlarmsPanel, formatDuration(), Panel, RecordedEvent, Recording, button(), div() (+4 more)

### Community 14 - "Control Panel Widgets & Definitions"
Cohesion: 0.13
Nodes (12): ControlPanelDef, Widget, widgetAcceptsTag(), WidgetType, ControlPanels, WIDGET_TYPES, createPanel(), PanelOpts (+4 more)

### Community 15 - "CLAUDE.md Architecture Notes (MQTT/Modbus rationale)"
Cohesion: 0.12
Nodes (20): Automation Sim — Agent Guide (CLAUDE.md), modbus-serial (npm Modbus client), Modbus Client Serialization Queue, mosquitto (system MQTT broker), MQTT Command/State Topic Split, mqtt.js, node-opcua, node-snap7 (native dev dependency) (+12 more)

### Community 16 - "TIA Web Adapter Tag Discovery"
Cohesion: 0.15
Nodes (7): DiscoveredTag, discoverTags(), Discovery, TiaState, TiaWebAdapter, TiaWebTagConfig, AdapterContext

### Community 17 - "Frontend Dependencies (Babylon.js/Havok)"
Cohesion: 0.11
Nodes (17): dependencies, @babylonjs/core, @babylonjs/havok, @babylonjs/loaders, @sim/shared, devDependencies, typescript, vite (+9 more)

### Community 18 - "Machine Engine Tag IO (EngineIO)"
Cohesion: 0.15
Nodes (5): EngineIO, Deps, GizmoMode, MachineIO, Rig

### Community 19 - "Command Palette Core"
Cohesion: 0.19
Nodes (9): Command, CommandProvider, fuzzyScore(), revealPanel(), Scored, ranksAbove(), buildCommandProviders(), Deps (+1 more)

### Community 20 - "Online Menu (TIA Connection Manager UI)"
Cohesion: 0.25
Nodes (3): labeled(), normalizeUrl(), OnlineMenu

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
Cohesion: 0.24
Nodes (9): MACHINE_CATALOG, MachineDef, MachineKind, MachineParamValue, MachinePort, newMachine(), ParamSpec, TagSlotSpec (+1 more)

### Community 29 - "Conveyor Loop Integration Probe"
Cohesion: 0.22
Nodes (9): latest, main(), ok(), project, results, sleep(), waitFor(), write() (+1 more)

### Community 30 - "TIA Web Adapter Probe"
Cohesion: 0.23
Nodes (9): latest, main(), ok(), project, results, sleep(), waitFor(), write() (+1 more)

### Community 37 - "Panel Registry & Panels Menu Types"
Cohesion: 0.27
Nodes (5): Listener, PanelEntry, WORKSPACE_PRESETS, WorkspacePreset, PanelsMenu

### Community 39 - "Control Panel Widget Builders"
Cohesion: 0.42
Nodes (9): arcPath(), buildButton(), buildGauge(), buildKnob(), buildLed(), buildSwitch(), buildWidget(), polar() (+1 more)

### Community 40 - "MQTT Adapter"
Cohesion: 0.22
Nodes (3): coerce(), MqttAdapter, walkPath()

### Community 41 - "Machines Smoke-Test Probe"
Cohesion: 0.39
Nodes (8): latest, main(), ok(), results, sleep(), waitFor(), write(), ws

### Community 42 - "OPC UA Server Simulator Script"
Cohesion: 0.25
Nodes (6): mixer, ns, { OPCUAServer, Variant, DataType, StatusCodes, MessageSecurityMode, SecurityPolicy }, PORT, require, server

### Community 45 - "MCP Server Dependencies"
Cohesion: 0.29
Nodes (6): dependencies, @modelcontextprotocol/sdk, main, name, type, version

### Community 46 - "Modbus PLC Simulator Script"
Cohesion: 0.29
Nodes (5): ModbusRTU, PORT, require, server, vector

### Community 47 - "Shared Package Manifest"
Cohesion: 0.29
Nodes (6): exports, name, private, type, types, version

### Community 49 - "Connections Panel Rationale (Heartbeat/LWT)"
Cohesion: 0.47
Nodes (3): 2s Heartbeat Republish for Change-Driven Publishing, MQTT LWT Device Liveness, ConnectionsPanel

### Community 50 - "S7 PLC Simulator Script"
Cohesion: 0.33
Nodes (5): initial, PORT, require, server, snap7

### Community 52 - "MCP Server Implementation"
Cohesion: 0.40
Nodes (4): __dirname, server, transport, VAULT

### Community 53 - "MQTT Device Simulator Script"
Cohesion: 0.40
Nodes (3): client, mqtt, require

### Community 54 - "Trend Panel Data Sampling"
Cohesion: 0.40
Nodes (4): fmt(), Sample, Series, WINDOWS

## Knowledge Gaps
- **256 isolated node(s):** `node`, `name`, `version`, `type`, `main` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TagStore` connect `Connections Panel & Adapter Health` to `Binding Engine & Transform Application`, `Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)`, `Trend Panel Charting`, `Control Panel Widget Builders`, `Panel Layout & Column Resize`, `Bindings Types & Gateway Config Rationale`, `Alarms Evaluation & Panel`, `Control Panel Widgets & Definitions`, `CLAUDE.md Architecture Notes (MQTT/Modbus rationale)`, `Connections Panel Rationale (Heartbeat/LWT)`, `Machine Engine Tag IO (EngineIO)`, `Command Palette Core`, `Online Menu (TIA Connection Manager UI)`, `Trend Panel Data Sampling`, `Replay Panel`, `Machine Catalog & Types`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `Automation Sim — Agent Guide (CLAUDE.md)` connect `CLAUDE.md Architecture Notes (MQTT/Modbus rationale)` to `Binding Engine & Transform Application`, `Project File Menu & Save/Load`, `OPC UA Adapter`, `Connections Panel & Adapter Health`, `MQTT Adapter`, `Bindings Types & Gateway Config Rationale`, `TagBus Core (register/refresh/write)`, `Alarms Evaluation & Panel`, `Connections Panel Rationale (Heartbeat/LWT)`, `Replay Panel`, `Modbus TCP Adapter`, `S7 (Siemens) Adapter`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `AdapterMeta` connect `Protocol Adapter Configs (Modbus/MQTT/Conveyor/Mixer)` to `OPC UA Adapter`, `Gateway WS Message Types & Index`, `Connections Panel & Adapter Health`, `MQTT Adapter`, `Conveyor Machine Model Adapter`, `TagBus Core (register/refresh/write)`, `TIA Web Adapter Tag Discovery`, `Mixer Machine Model Adapter`, `Modbus TCP Adapter`, `S7 (Siemens) Adapter`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `node`, `name`, `version` to the rest of the system?**
  _256 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Binding Engine & Transform Application` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Physics Parts Manager (BoxManager)` be split into smaller, more focused modules?**
  _Cohesion score 0.13876040703052728 - nodes in this community are weakly interconnected._
- **Should `Project File Menu & Save/Load` be split into smaller, more focused modules?**
  _Cohesion score 0.10483870967741936 - nodes in this community are weakly interconnected._
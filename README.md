# Automation Sim

Browser-based real-time 3D hardware telemetry built on Babylon.js. Import 3D
models (GLB), bind scene nodes and materials to live tag streams from PLCs,
microcontrollers, and simulators, and view or control the machine as a live
replica.

**Current state: polish phase done** — connections panel (adapter + LWT device
health), alarm rules with a live active-alarms panel, record & replay of the
tag stream (transport controls; live data suppressed during replay), widget
staleness dimming, and bindings that restore the node's original pose when
removed.

The gateway speaks four protocols, all declared in
`gateway/config.json`: the built-in simulator, **Modbus TCP** (polling,
scale/offset, writes, reconnect), **OPC UA** (true subscriptions via monitored
items, typed writes, heartbeat), and **MQTT** (topic→tag mapping with optional
JSON-path payload extraction, command/state topic split for writes, retained
message pickup). Every adapter publishes an `<id>.online` health tag. Local
device sims: conveyor PLC (`plc-sim`, Modbus 5020), mixer skid (`opcua-sim`,
opc.tcp 4850), and an ESP32-style fan node (`mqtt-sim`, uses the system
mosquitto on 1883, topics under `automation-sim/`). Point config.json at real
hardware — a PLC, an ESP32 running open62541, or any MQTT device — to go live.

## Run

```bash
npm install
npm run dev     # fake PLC (5020) + OPC UA mixer (4850) + MQTT fan node + gateway (8082) + app (5173)
```

The MQTT device sim expects a broker on `mqtt://127.0.0.1:1883` (e.g. the
system mosquitto).

Connections are declared in `gateway/config.json` — adapter types:
- `simulator` — built-in demo machine
- `modbus` — host/port/unitId/pollMs + tag map (kind coil|discrete|holding|input,
  address, scale/offset, signed, writable)
- `opcua` — endpoint + tag map (nodeId, dataType, writable); values arrive via
  subscription, writes use the server's resolved data type
- `mqtt` — url (+credentials) + tag map (topic, optional commandTopic for
  writes, optional jsonPath into JSON payloads, dataType, writable, retain)

What you should see: a two-link robot arm swinging (driven by `sim.armAngle` /
`sim.forearmAngle`), a status lamp that glows green while `sim.running` is true
and dark red while stopped (the arm freezes in place), and a HUD (top-left)
with connection status and live tag values.

Gateway smoke test: `npm run probe -w @sim/gateway`

Regenerate the demo model: `npm run glb`

## Layout

```
frontend/   Vite + TypeScript + Babylon.js app
            bindings/ (types + transform eval + frame engine), projectStore,
            scene tree + viewport picking, binding editor panel,
            tag store, WS client, HUD, live tag table
gateway/    Node.js gateway: TagBus (pub/sub core) + Adapter interface
            adapters/simulator.ts (~30 Hz demo machine); later: Modbus/OPC UA/MQTT
shared/     message schema shared by both (hello with snapshot / tagUpdate)
scripts/    make-demo-glb.mjs — dependency-free GLB generator for the demo arm
```

## Roadmap

1. ~~Spike: GLB + WS + hardwired bindings~~
2. ~~Tag bus + simulator adapter (read-only), live-value table~~
3. ~~Binding engine + editor UI (scene tree, node picker, binding CRUD, project save/load)~~
4. ~~Control panel widgets (buttons, switches, knobs, LEDs, gauges) + tag write path~~
5. ~~Modbus TCP adapter (read + write, config-driven, reconnect + online tag)~~ *(done ahead of MQTT)*
6. ~~OPC UA adapter (subscriptions, typed writes, reconnect, heartbeat)~~
7. ~~MQTT gateway adapter (topic→tag, JSON paths, command/state writes, retained)~~
   *(browser-direct MQTT deferred to the connection-manager work)*
8. ~~Polish: widget staleness, connections panel, alarms (rules + active list),
   record/replay with live suppression, binding baseline restore, MQTT
   last-will device liveness~~
9. Backlog: S7, Raspberry Pi GPIO agent, in-app connection manager (edit
   gateway config from the browser), browser-direct MQTT, alarm
   acknowledge/history, 32-bit Modbus registers, OPC UA Sign&Encrypt

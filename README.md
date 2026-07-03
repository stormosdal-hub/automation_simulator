# Automation Sim

Browser-based real-time 3D hardware telemetry built on Babylon.js. Import 3D
models (GLB), bind scene nodes and materials to live tag streams from PLCs,
microcontrollers, and simulators, and view or control the machine as a live
replica.

**Current state: press + mixer machine models** — the hydraulic press and
mixer skid behaviors now also live on the bus as machine-model adapters
(`press`, `mixer` in config.json), ported from their protocol sims with the
same dynamics plus the sensors a ladder program wants: the press adds
`atTop`/`atBottom` limit switches and a `pressing` zone flag; the mixer adds a
`batchDone` pulse (~0.6 s, CTU-friendly), `batchProgress`, and an `overTemp`
alarm bit. Wire them to PLC logic with tag links (e.g.
`tia.Press_Run → press.runCmd`, `press.atTop → tia.Press_Top`,
`mixer.batchDone → tia.Batch_Sensor`) — add the matching tags to the `tia`
adapter entry and author the ladder in the TIA app. Smoke test:
`npm run machines-probe -w @sim/gateway` (gateway only, ~35 s).

Previously: **closed-loop virtual commissioning** — the gateway has a
**tag-link bridge** (`config.links`: route any adapter's tag into another's
write, change-driven, type-coerced, offline-tolerant) and a **conveyor machine
model** adapter (belt physics on the bus: auto part feeder, photo-eye,
`part<N>Pos` tags for 3D binding). Wired to the TIA Web PLC by the shipped
links — `tia.Motor → conv.motorCmd`, `tia.Conveyor_PWM → conv.speedCmd`,
`conv.photoEye → tia.Part_Sensor` — a ladder program authored in the TIA app
runs the virtual plant and the plant feeds its sensors back: press Start, the
seal-in latches, parts ride the belt, the eye pulses the PLC's counter, and
the belt speeds up as the PLC's NORM_X duty rises. Smoke test:
`npm run tia-loop-probe -w @sim/gateway` (asserts the whole loop with no
client writing any sensor).

Previously: **TIA Web PLC adapter** — the gateway connects to the
sibling **TIA Web Practice** project's PLC runtime (`plc_server.py`, HTTP API)
as a first-class device: polled tag values from `GET /api/state`, writes via
`POST /api/force`, `<id>.online` + `<id>.running` (PLC RUN/STOP, false while
unreachable) as bindable tags. Write a ladder program in the TIA app, download
it to the runtime (mock on your desk or real Pi GPIO), and bind its tags to the
3D scene here. Start the runtime with `npm run tia-sim -w @sim/gateway`
(expects `../TIA_Portal_Web-app` as a sibling checkout); smoke test:
`npm run tia-probe -w @sim/gateway` (drives a seal-in + counter program
end-to-end through the gateway).

Previously: **S7 adapter** — the gateway speaks Siemens S7comm
(ISO-on-TCP) via the pure-JS `nodes7` client: polled DB items (REAL / INT /
X bits), bit and register writes, reconnect + online tag. A fake hydraulic
press (`s7-sim`, snap7 server on port 9102 — real PLCs use 102) provides a
real S7 stack to develop against. Note: offline detection takes ~10 s
(nodes7 surfaces dead sockets via read timeouts), slower than Modbus's ~2 s.

Previously: connections panel (adapter + LWT device health), alarm rules with
a live active-alarms panel, record & replay of the tag stream, widget
staleness dimming, binding baseline restore.

The gateway speaks five protocols, all declared in
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
- `s7` — host/port/rack/slot/pollMs + tag map (nodes7 address like
  `DB1,REAL0` / `DB1,X8.0`, dataType, writable)
- `tiaweb` — url (+pollMs) of a TIA Web Practice runtime + tag map (name =
  the TIA tag name or address, dataType, writable); writable tags force PLC
  inputs/memory, so panel widgets and machine models can feed sensors
- `conveyor` — machine model (no external device): beltLength/eyeAt/maxSpeed/
  minSpeed/autoFeedS/partSlots; writable `motorCmd`/`speedCmd`/`feed`, read
  `photoEye`, `beltSpeed`, `partsOnBelt`, `partsDone`, `part1Pos…partNPos`
- `press` — machine model: strokeS/defaultTarget/maxPressure; writable
  `runCmd`/`targetPressure`, read `ramPosition`, `pressure`, `cycleActive`,
  `cycleCount`, `pressing`, `atTop`, `atBottom`
- `mixer` — machine model: batchS/overTempC/defaultSpeed; writable
  `agitatorOn`/`agitatorSpeed`, read `tankLevel`, `motorTemp`, `batchCount`,
  `batchProgress`, `batchDone` (pulse), `overTemp`

Top-level `links` route tags between adapters without any client connected
(change-driven, coerced to the target's type, `scale`/`offset`/`invert`):

```json
"links": [
  { "from": "tia.Motor", "to": "conv.motorCmd" },
  { "from": "conv.photoEye", "to": "tia.Part_Sensor" }
]
```

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
9. ~~S7 adapter (nodes7 client, snap7-server press sim, writes, reconnect)~~
10. ~~TIA Web PLC adapter (HTTP poll + force writes, online/running tags,
    `tia-probe` end-to-end smoke test)~~
11. ~~Closed loop: gateway tag-link bridge (`config.links`) + conveyor
    machine-model adapter, `tia-loop-probe` end-to-end smoke test~~
12. ~~Press + mixer machine models (bus-adapter ports of the protocol sims,
    PLC-friendly sensors, `machines-probe` smoke test)~~
13. Backlog: Modbus-server mode in the TIA runtime (then any SCADA can
    connect), Raspberry Pi GPIO agent, in-app connection manager (edit
    gateway config from the browser), browser-direct MQTT, alarm
    acknowledge/history, 32-bit Modbus registers, OPC UA Sign&Encrypt,
    faster S7 offline detection

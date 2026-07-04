# Automation Sim

Browser-based real-time 3D hardware telemetry built on Babylon.js. Import 3D
models (GLB), bind scene nodes and materials to live tag streams from PLCs,
microcontrollers, and simulators, and view or control the machine as a live
replica.

**Current state: find PLCs without a terminal** — the **Online ▾** menu has a
**Search network** button: enter a port (default 8000) and the gateway scans
its local subnet(s) for TIA Web Practice runtimes, lists the ones it finds
(IP:port + program + RUN state), and one click drops a result into the connect
form — no `curl` or `hostname -I` needed. (On the TIA side, its own app now has
an **Address** pop-up that shows the runtime's hostname/URL — the two halves of
"which address do I type?") The scan is read-only (a plain `GET /api/info` per
host, the same probe *Test connection* uses), bounded to a couple of /24s, and
only runs when you click the button.

Previously: **trend charts + a multi-PLC connection manager.** A **Trends** panel
plots any numeric or boolean tag over a rolling window as a sparkline (auto-scaled
line + hover crosshair; boolean step line). The **Online ▾** menu manages several
TIA runtimes at once — each a named connection whose tags namespace by id
(`line1.Motor`, `press-plc.Motor`) — add/redirect/remove live, no restart. Great
for a Raspberry Pi PLC + your desktop:
[`docs/networking-two-computers.md`](docs/networking-two-computers.md).

Previously: **tags sync themselves + a resizable UI.** Edit tags in the TIA app
and hit **Download → PLC** and the gateway re-discovers them on its own (the
runtime stamps each download with a `programRev` the adapter watches) — no ⟳
click, no restart. Both side columns scroll when the panel stack is tall, each
panel body drag-resizes + scrolls inside, and each column's width drags via a
handle; widths and heights persist in localStorage.

Previously: **an Online menu, no config.json required** — connect the gateway to
a TIA runtime live by typing a `host:port` (same machine, another machine on
your LAN/Wi-Fi, or a Raspberry Pi), **Test** it's really a runtime, then
**Connect** — no gateway restart, no `tiaweb` entry in `config.json` needed. A
bad address is rejected without disturbing whatever's connected.

Previously: **live tag refresh, no restart** — the **⟳** button next to the
`tia` adapter in the Connections panel re-imports the tag list on demand
(added/edited/removed reconciled live), the pull counterpart of the automatic
re-discovery above. Only shown for adapters that support it
(`AdapterMeta.canRefreshTags`) — currently `tiaweb` in auto-discovery mode (no
explicit `tags` array in config.json).

Previously: **zero-JSON setup** — the `tiaweb` adapter discovers its tags
automatically: leave `tags` out of its `config.json` entry (just
`type`/`id`/`url`/`pollMs`) and it fetches `GET /api/tags` from the TIA
runtime and publishes every declared project tag, writable, with no
hand-typed tag list to keep in sync. An explicit `tags` array still works if
you want to curate a subset instead. The frontend also gained a **File menu**
(top-left): New / Open / Save project as JSON — projects were localStorage-only
before; Save downloads the current project, Open loads one back in (both New
and Open replace the project and reload the page so every panel re-initializes
cleanly).

Previously: **TIA runtime speaks Modbus TCP too** — the sibling TIA Web
Practice PLC runtime (`plc_server.py`) can also serve standard Modbus TCP
(`--modbus-port`), so this gateway's existing generic **`modbus`** adapter can
talk to it directly — no new adapter code needed, and any other SCADA/HMI can
connect the same way. Addresses map onto the runtime's S7-style `%I/%Q/%M`
memory (`GET /api/modbus-map` on the runtime lists the derived
coil/discrete/holding/input address for every tag); see
`TIA_Portal_Web-app/README.md` → "Modbus TCP server mode". For a full,
step-by-step walkthrough of wiring the two projects together (with or without
real Raspberry Pi hardware), see
[`docs/connecting-tia-web-practice.md`](docs/connecting-tia-web-practice.md).

Previously: **press + mixer machine models** — the hydraulic press and
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
- `tiaweb` — url (+pollMs) of a TIA Web Practice runtime, and even that's
  optional now — the **Online ▾** topbar menu can create/redirect/remove these
  connections live, so `config.json` doesn't need a `tiaweb` entry at all to
  get started. Declare **several** `tiaweb` entries (distinct `id`s) — or add
  them from the Online menu — to front multiple PLCs at once; their tags
  namespace by id (`line1.Motor`, `press-plc.Motor`). `tags` is likewise
  optional — omit it and every declared
  project tag is discovered from `GET /api/tags` and published writable
  (forcing is unconditional on the runtime's side anyway), so panel widgets
  and machine models can feed sensors with no config.json tag list to
  maintain. Pass `tags` explicitly to curate a subset instead (this also
  freezes the list — no auto-refresh or ⟳ button). In discovery mode the tag
  set stays in sync **automatically**: the adapter watches the runtime's
  `programRev` while polling and re-discovers the moment it changes (i.e. as
  soon as the TIA app does Download → PLC), so edited/added/removed tags apply
  across every connected browser with no restart and no click. The Connections
  panel's **⟳** button forces the same refresh on demand.
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
13. ~~Modbus-server mode in the TIA runtime (`plc_server.py --modbus-port`,
    `/api/modbus-map`) — any SCADA can connect, and this gateway's own
    `modbus` adapter works against it unchanged~~
14. ~~Tag auto-discovery (`tiaweb` adapter reads `GET /api/tags`, no
    config.json tag list required) + frontend File menu (New/Open/Save
    project as JSON, in addition to localStorage)~~
15. ~~Live tag refresh: a bus-level `refreshAdapterTags()` reconciles one
    adapter's tag set at runtime (add/edit/remove), a WS `refreshTags` request
    + `tagsChanged` broadcast carry it to every connected browser, and a
    per-adapter **⟳** button in the Connections panel triggers it — no
    gateway restart, no page reload~~
16. ~~In-app connection manager for the TIA link: `TiaConnectionManager`
    hot-swaps the `tia` adapter to a new URL live (probed first, so a bad
    address never tears down a working connection), works with no prior
    `tiaweb` config.json entry at all, and the frontend's **Online ▾** menu
    (host:port input, Test connection, Connect) drives it — proven over a
    real (non-loopback) network address, not just localhost~~
17. ~~Automatic tag re-discovery: the runtime stamps downloads with a
    `programRev`, the `tiaweb` adapter watches it while polling and asks the
    bus to re-discover on change (adapter→bus `requestTagRefresh`, one shared
    `onTagsChanged` broadcast for both the auto path and the ⟳ button) — tags
    sync on Download → PLC with no client action~~
18. ~~Resizable/scrollable panel layout: both side columns scroll, panel
    bodies drag-resize (`resize: vertical`) + scroll inside, per-column width
    drag handles (`layout.ts`), widths + heights persisted to localStorage~~
19. ~~Trend charts: a Trends panel (`trendPanel.ts`) plotting numeric/boolean
    tags over a rolling window as canvas sparklines (auto-scale, hover
    crosshair, boolean step line), own ring buffers, selection + window
    persisted~~
20. ~~Multi-PLC connection manager: `TiaConnectionManager` holds several named
    TIA connections (`connect(id,url)` / `remove(id)`), the Online menu lists +
    adds + redirects + removes them live, tags namespace by connection
    (`adapterRemoved` broadcast drops a removed one everywhere)~~
21. ~~LAN discovery + address helpers: the Online menu's **Search network**
    button (gateway-side `netscan.ts` sweeps the primary /24s probing
    `/api/info`) lists reachable runtimes to pick from; the TIA app's
    **Address** pop-up (`/api/netinfo`) shows the runtime's own hostname/URL —
    so neither side needs `curl`/`hostname -I`~~
22. Backlog: Raspberry Pi GPIO agent, in-app connection manager for *other*
    adapter types (modbus/opcua/mqtt/s7 host/port editing from the browser),
    browser-direct MQTT, alarm acknowledge/history + browser notifications,
    tag history logging / CSV export, 32-bit Modbus registers (client-side
    register-pair combining in the gateway's own `modbus` adapter), OPC UA
    Sign&Encrypt, faster S7 offline detection, draggable/dockable panels
    (currently fixed left/right columns)

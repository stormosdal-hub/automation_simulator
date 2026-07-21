# Automation Sim

Browser-based real-time 3D hardware telemetry built on Babylon.js. Import 3D
models (GLB), bind scene nodes and materials to live tag streams from PLCs,
microcontrollers, and simulators, and view or control the machine as a live
replica.

**Current state: command palette — jump anywhere with Ctrl/Cmd-K** — press
**Ctrl+K** (or ⌘K) to open a fuzzy-searchable overlay and jump straight to any
panel, machine, tag, workspace preset, or action — no hunting through the panel
stack. Type "lt" for *Live tags*, a machine's name to select it in the 3D
scene, a tag name to flash its row, or a preset to reshape the whole layout.
Jumping to a hidden panel reveals and highlights it. ↑/↓ to move, Enter to run,
Esc to close.

Previously: **workspaces — tame the panel stack** — a topbar **Panels ▾**
menu now shows or hides each overlay panel individually (a checkbox per panel,
grouped by column) and applies one-click **workspace presets** — *Build*
(machines, scene, bindings, tags), *Operate* (controls, trends, alarms),
*Diagnose* (connections, alarms, record/replay), or *All* — so you switch the
whole screen between authoring a line and running it instead of scrolling a
nine-panel wall. Your choice (per-panel and the active preset) persists across
reloads, and Scene/Bindings stay hidden until a 3D model is actually imported.

Previously: **process simulation — tanks, pumps, valves, PID-ready** —
three **process machines** join the library. A **water tank** integrates its
volume live (dV/dt = ΣQin − ΣQout), shows the water rising with a floating %
readout, and publishes **level %** (the PID process value) plus high/low
switches to tags. A **pump** moves water between endpoints at `speed %` —
the natural home for your controller output — and starves realistically on an
empty tank; a **valve** flows by gravity head (Q ∝ position·√ΔH — the
textbook nonlinear tank dynamic), both with a `flow` L/s sensor tag.
**Pipes route themselves**: pick each element's *From/To* (a tank, the
`supply` mains, or the `drain`) and the piping is drawn — and redrawn when
you move a tank (which keeps its water). Both get Manual-override jog +
speed/position sliders. Proven end-to-end with a **closed level-control loop
built in TIA ladder math** (SP=60; `SUB` Err = SP − Level; `MUL` Out = 8·Err
→ pump speed): the level rose from 20 %, settled at ~54 % (honest P-droop),
tracked in the PLC's own memory word, and re-settled after the drain load was
doubled mid-run. Build PI/PID the same way — the plant is ready for it.

Previously: **hand control and PLC speed setpoints** — every machine now
has a **Manual override** section in its properties (the relay-test-button /
PLC-force analog): 3-state **Auto | On | Off** segments jog the motor
(conveyor/curve), cylinder (pusher), blade (gate), rotation (turntable), even
**force a photo-eye** blocked/clear so your ladder inputs fire with no part
anywhere; stack lights get a lamp test, bins a count reset, and conveyors/
curves/turntables a **speed-override slider** (0–100 %). Overrides live only
in the session (never saved), survive parameter edits, and machines under
manual show a ✋ badge in the list. On the PLC side, **speed is a number you
write from TIA Portal**: the Speed slots accept any numeric tag — an `Int`/
`Word` at `%MW…` or a `Real` — interpreted as 0–100 %. Proven end-to-end: a
ladder `MOVE 30` / `MOVE 90` into `Speed_SP` (Int, MW12) made the physical
belt run ~3× faster at 90, and the PLC's Motor bit stopped it.

Previously: **turntables, snap-together belts, and andon lights** — three
more library pieces. The **turntable** is a rotating disc that carries parts
around its axis: unbound it spins continuously (carousel); bound to a `rotate`
tag it becomes a 0°↔angle **indexing table** with `atHome`/`atEnd` end-switch
write-backs (loose parts slide a little on an abrupt stop — time your ladder,
or gate them). The **stack light (andon)** is a red/amber/green signal tower —
each lamp lights (optionally blinks at 1 Hz) while its bool tag is true; the
sorting sample now flashes its amber lamp on every divert. And arrange mode
got **conveyor snapping**: drag a belt or curve near another's end and it
clicks into place — position *and rotation* solve so the flow ports align
(entry↔exit, matching belt heights) — then parts ride straight across the
seam; verified by dragging a 37°-rotated belt onto a straight one and watching
a box cross.

Previously: **curves, inclines, sorting, and hands-on parts** — the machine
library grew: conveyors take a **rise** (inclined belts that carry parts uphill
and hold them on a stop) and a **rails** choice (both/left/right/none — leave a
side open for diverting), and there's a **curved conveyor** (segmented arc,
15–180°, either direction) that carries parts around corners. The photo-eye
gained a **color mode** (a vision sensor: sees accent-colored parts, ignores
plain cardboard), and parts are now **grabbable** — click and drag any part
with the mouse (camera pauses), flick to **throw** it. A new gateway `memory`
adapter (`virtual.b1…`) provides writable **virtual tags for soft wiring**:
bind a sensor's output and an actuator's input to the same tag and they couple
directly, no PLC needed. All of it comes together in **File ▾ → Sample:
Sorting line** — a dropper feeds mixed parts down a belt; a color eye fires
`virtual.b1`; a pusher shoves colored parts into one bin while plain ones ride
to the other. Verified headless end-to-end: colored → colored bin, plain →
plain bin, zero PLC.

Previously: **a physics machine library** — the scene has real physics
(Babylon's **Havok** engine, WASM) and a placeable **machine library**: conveyor
belts, photo-eye sensors, pusher cylinders, stop gates, collection bins, and
part droppers, managed from the new **Machines** panel. Drop boxes/cylinders/
balls onto a running belt (**Shift+click** anywhere, a spawner's *Drop now*
button, a timer, or a PLC tag edge) and they tumble, ride, stack, and fall like
real parts. Machines bind to live tags both ways: a conveyor's motor/speed
**read** PLC outputs, while photo-eyes, pusher end-switches, and bin count
pulses **write** PLC inputs through the normal gateway write path — so a ladder
program in the TIA app can run a *physical* line: press Start, the seal-in
latches `Motor`, the belt carries falling parts through the photo-eye, and the
beam pulses clock the PLC's real CTU counter. Machines are placed/rotated in a
properties editor or dragged on the ground in **Arrange** mode, and live in the
project JSON like bindings/panels/alarms (File → Save/Open). A fresh project
ships a working demo line (dropper → belt → photo-eye → bin); wire its motor
and eye tags to a PLC to close the loop.

Previously: **find PLCs without a terminal** — the **Online ▾** menu has a
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
npm test        # unit tests (Vitest) — pure logic, no network or browser needed
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
- `memory` — virtual tags with no device (soft wiring): every tag is writable
  and a write just publishes the value back. Used to couple one scene
  machine's sensor to another's actuator directly (see the sorting-line
  sample); default entry `virtual` ships `b1…b4` (bool) + `n1`/`n2` (number)

Top-level `links` route tags between adapters without any client connected
(change-driven, coerced to the target's type, `scale`/`offset`/`invert`):

```json
"links": [
  { "from": "tia.Motor", "to": "conv.motorCmd" },
  { "from": "conv.photoEye", "to": "tia.Part_Sensor" }
]
```

What you should see: a HUD (top-left) with connection status and live tag
values, and the demo **machine line** — a part dropper feeding a conveyor that
carries boxes through a photo-eye into a counting bin (every 6 s; Shift+click
drops extras anywhere).

Scenes are built from the machine library, so a project has no 3D model by
default (`modelUrl: null`). Importing a project whose `modelUrl` points at a
GLB still works: the model loads and the **Scene** (node tree) and **Bindings**
panels appear in the left column to bind tags to its node properties. Without a
model those two panels stay hidden.

### The machine library (Machines panel, left column)

- **Add** a machine (conveyor / curved conveyor / turntable / photo-eye /
  pusher / stop gate / bin / part dropper / stack light / **water tank /
  pump / valve**), select it in the list **or click it in the viewport**,
  then edit its name, X/Z, rotation, and per-kind parameters (belt speed,
  beam height, stroke, drop interval, part shape/size, tank size, max flow…).
- **Process loops**: tank *Level %* / *High* / *Low* write to tags; pump
  *Run*/*Speed %* and valve *Open*/*Position %* read tags; both publish
  *Flow L/s*. Set each pump/valve's **From/To** (a tank, `supply`, `drain`)
  and the pipes draw themselves. Classic level loop: pump `speed` ←
  `tia.Out`, tank `level` → `tia.Level`, a gravity valve to `drain` as the
  load — then write the controller in TIA ladder math (P: `SUB`+`MUL`; add an
  integrator rung for PI). Valves flow by √head, so the dynamics are the real
  nonlinear thing PID tuning is practiced on. Conveyors take a **rise** (incline) and a **rails** choice
  (both/left/right/none); curves take a radius and a signed turn angle
  (+left/−right, entry along the machine's +X). Photo-eyes can **detect:
  color** — only accent-colored parts break the beam (the beam shows purple
  when idle in color mode). The **turntable** spins continuously when unbound
  or indexes 0°↔angle on its `rotate` tag (with `atHome`/`atEnd` write-backs);
  the **stack light** lights red/amber/green lamps from bool tags (optional
  blink).
- **Tag bindings** per machine: *read* slots drive it (conveyor `motor` +
  `speed %`, pusher `extend`, gate `raise`, dropper `trigger` edge), *write*
  slots feed sensors back (photo-eye `output`, pusher `atEnd`/`atHome`, bin
  count `pulse`) — writes go through the same gateway path as panel widgets,
  so any writable tag (e.g. a TIA `%I` input) works. **Speed slots take any
  numeric tag** — a TIA `Int`/`Word` (`%MW…`) or `Real` — read as 0–100 %; a
  ladder `MOVE`/`CALCULATE` writing that word sets the belt/turntable speed.
- **Manual override** (in the properties editor): Auto | On | Off segments to
  jog each machine by hand — run/stop a belt, extend a cylinder, raise a
  gate, index a turntable, **force a photo-eye** blocked/clear (its tag
  really writes, so you can exercise ladder inputs with no parts), lamp-test
  a stack light, reset a bin count — plus a 0–100 % speed slider. Overrides
  are session-only (never saved into the project), survive parameter edits,
  and flag the machine with ✋ in the list. Auto hands control back to tags. Unbound conveyors/gates
  simply run/block so the library is playable with no PLC at all; a ⚠ in the
  list flags missing/wrong-type tags.
- **Arrange mode** drags machines on the ground plane (camera pauses during a
  drag), and chainable pieces **snap**: bring a conveyor/curve end near
  another's counterpart end (entry↔exit, belt heights within ~10 cm) and the
  dragged piece rotates + translates so the flow ports line up — release to
  commit; parts then ride across the seam. **Drop part** / **Shift+click**
  spawn parts; **Clear parts** removes them. Parts are capped (oldest culled) and anything that falls off the world
  is cleaned up. **Click and drag a part** to grab it (spring-follows the
  cursor at grab height); release mid-flick to **throw** it — grabbed parts
  stay physical, so you can stack them, feed them through sensors, or yank
  them out of bins.
- **Soft wiring**: the gateway's `memory` adapter (`virtual` in config.json)
  publishes writable do-nothing tags (`virtual.b1…b4`, `n1…n2`). Bind a
  photo-eye's output AND a pusher's extend to `virtual.b1` and the eye fires
  the pusher directly — machine-to-machine logic with no PLC and no `links`.
- **File ▾ → Sample: Sorting line** loads a ready-made demo of all of it:
  mixed parts drop onto a belt, a color eye + pusher divert colored parts into
  one bin via `virtual.b1`, plain cardboard rides through to the other.
- Machines persist in the project (localStorage + File → Save/Open). Physics
  needs WASM; if Havok can't load, machines still render and arrange — only
  parts are disabled (the panel says so).

Wire the demo line to a TIA PLC (assuming an Online ▾ connection named `tia`):
conveyor → *Motor (run)* = `tia.Motor`, photo-eye → *Output* =
`tia.Part_Sensor`, and author `Motor`'s seal-in + a CTU on `Part_Sensor` in
the TIA app — parts falling on the belt will clock the ladder counter.

Gateway smoke test: `npm run probe -w @sim/gateway`

Regenerate the demo model: `npm run glb`

## Layout

```
frontend/   Vite + TypeScript + Babylon.js app
            bindings/ (types + transform eval + frame engine), projectStore,
            machines/ (Havok physics world, machine catalog + rigs, part
            manager, engine) + machinePanel (library UI),
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
22. ~~Physics machine library: Havok (WASM) world in the scene, placeable
    parametric machines (conveyor, photo-eye, pusher, stop gate, bin, part
    dropper) with two-way tag bindings (motors read PLC outputs, sensors
    write PLC inputs), droppable parts (Shift+click / spawner / tag edge),
    Machines panel with properties + arrange-drag, machines persisted in the
    project JSON, demo line in fresh projects~~
23. ~~Library round 2: inclined belts (`rise`) + `rails` choice, curved
    conveyor kind (segmented arc, signed turn), color-mode photo-eye,
    mouse grab & throw for parts, gateway `memory` adapter (virtual tags for
    machine→machine soft wiring), and the File-menu **Sorting line** sample
    (color eye + pusher divert colored parts — verified E2E, no PLC)~~
24. ~~Library round 3: turntable (carousel / tag-indexed 0°↔angle with
    atHome/atEnd write-backs, parts carried from the disc's yaw rate),
    conveyor end-snapping in arrange mode (`machinePorts` + rotation/position
    solve, verified with a real drag + a part crossing the seam), and the
    stack-light andon (R/A/G lamps from bool tags, blink; in the sorting
    sample the amber lamp flashes per divert)~~
25. ~~Manual override + numeric speed from the PLC: per-machine Auto/On/Off
    jog segments, photo-eye forcing, lamp test, bin reset, 0–100 % speed
    slider (session-only, ✋ badge, survives rebuilds); turntable speed tag
    slot; proven Int-from-ladder speed control (MOVE 30/90 → `%MW` →
    belt physically ~3× faster)~~
26. ~~Process simulation: FluidNet (lumped tank volumes, dV/dt integration),
    tank/pump/valve machines with level/flow/switch tags + From/To
    connection dropdowns + auto-routed pipes (redrawn on move, water kept),
    √-head valve dynamics, starved pumps, numeric tag writes (`writeNum`);
    verified with a TIA-ladder P-controller holding tank level against a
    doubled drain disturbance~~
27. ~~Panel workspaces: a topbar **Panels ▾** menu shows/hides each overlay
    panel individually (checkbox per panel, grouped by column) and applies
    **workspace presets** (Build / Operate / Diagnose / All) that toggle a
    whole set at once. A `panelRegistry` owns every panel's visibility
    (`createPanel` auto-registers; control panels group under `cp:` ids;
    Scene/Bindings register `available:false` until a GLB loads); intent
    persists per panel + the active preset to localStorage. Verified headless:
    presets show exactly their set, individual toggles hide/show, and the
    choice survives reload~~
28. ~~Command palette (Ctrl/Cmd-K): a fuzzy-searchable overlay to jump to any
    panel, machine, tag, workspace preset, or action without hunting the panel
    stack. `commandPalette.ts` (generic overlay + subsequence fuzzy matcher) +
    `commands.ts` (providers from live state; scores clean `matchText` not the
    decorated title). Jumping to a panel reveals + un-collapses + flashes it;
    to a machine selects it; to a tag flashes its Live-tags row. Verified
    headless: Ctrl-K opens, "lt"→Live tags / "conv"→Conveyor rank correctly,
    Enter reveals a hidden panel, Esc closes~~
29. ~~Test harness: Vitest unit tests for the pure logic (TagBus, tag links,
    FluidNet, binding transforms, panel registry + presets, command-palette
    fuzzy match) — 60 tests, no network/browser — plus a GitHub Actions CI
    workflow running `npm ci` → typecheck → test on every push/PR. The
    existing `*-probe` scripts remain the integration layer above~~
30. Backlog: Raspberry Pi GPIO
    agent, in-app connection manager for *other* adapter types
    (modbus/opcua/mqtt/s7 host/port editing from the browser),
    browser-direct MQTT, alarm acknowledge/history + browser notifications,
    tag history logging / CSV export, 32-bit Modbus registers (client-side
    register-pair combining in the gateway's own `modbus` adapter), OPC UA
    Sign&Encrypt, faster S7 offline detection, draggable/dockable panels
    (currently fixed left/right columns)

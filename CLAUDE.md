# Automation Sim — agent guide

Browser-based real-time 3D hardware telemetry: Babylon.js frontend, Node.js
gateway that normalizes device protocols into one WS tag stream. Roadmap and
current phase live in README.md — follow that order.

## Commands

```bash
npm run dev                      # fake PLC (5020) + gateway (ws://localhost:8082) + vite (http://localhost:5173)
npm run typecheck                # all workspaces
npm run probe -w @sim/gateway    # gateway smoke test (hello + updates)
npm run plc-sim -w @sim/gateway    # fake conveyor PLC, Modbus TCP on 5020
npm run opcua-sim -w @sim/gateway  # fake mixer skid, OPC UA on 4850 (first run generates certs, ~5s)
npm run mqtt-sim -w @sim/gateway   # fake ESP32 fan node — needs the system mosquitto on 1883
npm run s7-sim -w @sim/gateway     # fake hydraulic press, S7comm (snap7 server) on 9102
npm run tia-sim -w @sim/gateway    # sibling TIA Web Practice PLC runtime (mock), HTTP on 8000
npm run tia-probe -w @sim/gateway  # tiaweb adapter smoke test (needs gateway + tia-sim running;
                                   #   gateway on 8092: GATEWAY_PORT=8092 npm run start -w @sim/gateway)
npm run tia-loop-probe -w @sim/gateway  # closed-loop test: PLC ⇄ conveyor via links (~30 s, same setup)
npm run machines-probe -w @sim/gateway  # press + mixer machine-model test (~35 s, gateway only)
```

## Architecture

- `shared/src/index.ts` — the message schema (hello / tagUpdate / refreshTags
  / tagsChanged). Change here first; both sides import `@sim/shared` (TS
  source, no build step).
- `gateway/src/bus.ts` — TagBus: adapters publish in, subscribers fan out;
  keeps latest value per tag for hello snapshots. `register()` fixes an
  adapter's tag set once, at startup (`tagIndex` built from `adapter.tags`).
  `refreshAdapterTags(id)` is the one exception: it calls the adapter's
  optional `refreshTags()`, reconciles that adapter's *slice* of `tagIndex`
  live (add/update/remove) — a write against a since-removed tag then
  correctly fails as "unknown tag" — and fires `onTagsChanged` listeners.
  `onTagsChanged(fn)` is the single broadcast source the WS server subscribes
  to, so BOTH the ⟳ pull path and an adapter's own change-detection push path
  land in one place. `register()` hands each adapter a `requestTagRefresh()`
  (via `AdapterContext`) that just calls `refreshAdapterTags` on itself — that's
  the push path. Nothing else mutates `tagIndex` after registration.
- `gateway/src/adapter.ts` — Adapter contract. New data sources (OPC UA,
  MQTT, …) implement this; instances are declared in `gateway/config.json`
  and constructed in `gateway/src/index.ts`. Tag ids are `<adapterId>.<name>`,
  unique per gateway. Convention: every network adapter publishes
  `<adapterId>.online` (boolean) as a bindable health tag. Optional
  `refreshTags(): Promise<TagMeta[]>` opts an adapter into live re-discovery
  (advertise it via `meta.canRefreshTags` so the frontend shows a button).
  `start(publish, ctx?)` — `ctx.requestTagRefresh()` lets an adapter trigger
  its own re-discovery when it detects its tag set changed (see tiaweb).
- `gateway/src/adapters/modbus.ts` — Modbus TCP: per-kind span-batched polls,
  raw↔engineering via scale/offset (+signed int16), writes to coils/holding
  registers, offline after 3 failed polls with a 2 s reconnect loop. All
  client requests go through a serialization queue — modbus-serial's client
  must never see concurrent requests. Test against
  `gateway/scripts/modbus-plc-sim.mjs` (register map in its header comment);
  registers are unsigned — never let a simulated value go negative.
- `gateway/src/adapters/opcua.ts` — OPC UA via node-opcua: subscription-based
  (monitored items), not polled. Writable tags resolve the node's DataType
  attribute at connect for write coercion. Reconnection is owned by the outer
  loop (full teardown + fresh session/subscription on connection_lost) —
  node-opcua's internal retry is capped at 1 to avoid two mechanisms
  fighting. Change-driven publishing means unchanged tags would look stale:
  a 2 s heartbeat republishes cached values while connected. Test server:
  `gateway/scripts/opcua-server-sim.mjs` (node map in header comment).
- `gateway/src/adapters/mqtt.ts` — MQTT via mqtt.js: exact-topic subscribe,
  payloads parsed as JSON (optional dot `jsonPath`) or raw; writes publish to
  `commandTopic` (command/state pattern — device confirms by publishing its
  state topic). `<id>.online` reflects the BROKER connection, not device
  liveness — device liveness needs LWT topics (future). Same 2 s heartbeat as
  OPC UA. Device sim: `gateway/scripts/mqtt-device-sim.mjs` (topic map in
  header) — uses the system mosquitto on 1883; topics namespaced
  `automation-sim/`. Do NOT restart mosquitto (shared service; permission
  classifier blocks it).
- `gateway/src/adapters/tiaweb.ts` — sibling TIA Web Practice PLC runtime
  (`../TIA_Portal_Web-app/plc_server.py`) over its HTTP API: polls
  `GET /api/state` (tag values by NAME in `mem`), writes via `POST /api/force`
  (accepts names or `%I0.0` addresses). Stateless HTTP → no reconnect dance:
  the loop keeps polling and flips `<id>.online` after 3 failures.
  `<id>.running` mirrors PLC RUN/STOP and fails safe to false while offline.
  Unknown tag names are warned once (usually "program not downloaded yet").
  `TiaWebAdapterConfig.tags` is optional — the private constructor is only
  reachable via the async `TiaWebAdapter.create()` factory, which fetches
  `GET /api/tags` once and builds the tag list from every declared project
  tag (writable, since `/api/force` already forces anything unconditionally)
  when `tags` is omitted; `index.ts`'s adapter loop awaits `create()` before
  `bus.register()` because `TagBus` fixes an adapter's tag set at register
  time. `tags` is a **getter** computed from the adapter's private
  `tagConfigs` (not a frozen field) specifically so `refreshTags()` — which
  re-runs `GET /api/tags` and replaces `tagConfigs` wholesale — is reflected
  immediately; `meta.canRefreshTags` is `true` unless `config.tags` was given
  explicitly (nothing to discover, so refresh is a no-op returning the
  current tags). Two triggers: the Connections panel's **⟳** button (pull:
  `ConnectionsPanel` → WS `refreshTags` → `bus.refreshAdapterTags`), and
  **automatic** re-discovery (push) — `poll()`'s `maybeAutoRefresh()` compares
  the runtime's `programRev` (carried in `/api/state`) against the `lastRev`
  the tags were discovered at; on a mismatch (a Download → PLC happened) it
  calls `ctx.requestTagRefresh()`. Both land in `bus.onTagsChanged` →
  `server.ts` broadcasts one `tagsChanged` to every client, no gateway restart
  or page reload needed. `discoverTags()` returns `{tags, rev}` so `lastRev` is
  seeded from `/api/tags`' `programRev` (create + refresh both); an
  `autoRefreshing` guard prevents overlapping refreshes, and a failed refresh
  leaves `lastRev` stale so the next poll retries. Reminder: adding a tag in
  the TIA app does nothing until **Download → PLC** — that's what bumps
  `programRev` and puts the tag in `/api/tags`. E2E smoke test:
  `scripts/tiaweb-probe.mjs` (downloads a seal-in + CTU program, drives it
  through the gateway WS, checks writeError + offline; `offline` arg asserts
  the down state after killing the runtime). The runtime can *also* be
  reached with this gateway's plain `modbus` adapter type —
  `plc_server.py --modbus-port <port>` serves standard Modbus TCP over the
  same S7-style `%I/%Q/%M` memory (see `TIA_Portal_Web-app/README.md` →
  "Modbus TCP server mode" for the coil/discrete/holding/input address
  mapping); no gateway code changes needed for that path.
- `gateway/src/tiaConnection.ts` — `TiaConnectionManager` owns a **Map of
  named TIA connections** (multi-PLC): `connect(id, url)` calls `probeTia(url)`
  (`GET /api/info`, checked for the exact shape the runtime returns) *before*
  touching anything, so a bad address is rejected without disturbing a working
  connection; only on success does it `TiaWebAdapter.create()` a fresh adapter
  and `bus.unregisterAdapter(id)` (no-op if new) + `bus.register()` swap it in,
  recording the config under `id`. `remove(id)` unregisters + drops it.
  `index.ts` calls `tia.adopt(entry)` for **each** `tiaweb` config.json entry
  at startup (several PLCs can be declared), and `connect()` also works with no
  prior entry at all (first-time connect via the UI). Always forces fresh
  discovery on connect, even if a config entry had an explicit `tags` list — a
  different target may have entirely different tag names. Driven by the WS
  `testTia`/`connectTia {id,url}`/`removeTia {id}` client messages
  (`server.ts` replies `tiaConnected`/`tiaConnectError`/`tiaRemoved` to the
  requester and broadcasts `tagsChanged` on connect / `adapterRemoved` on
  remove) and the frontend's **Online ▾** menu (`onlineMenu.ts`). Tags
  namespace by connection id, so `line1.Motor` and `press.Motor` coexist.
- `gateway/src/netscan.ts` — `scanForRuntimes(port)` sweeps the gateway's
  local subnet(s) for TIA runtimes: `primaryIp()` (dgram UDP-connect trick, no
  packet sent) picks the main interface, `subnetsToScan()` derives up to 2
  /24 bases from `os.networkInterfaces()`, then a capped-concurrency pool
  probes `GET /api/info` on every host (short timeout) and keeps the ones that
  match the runtime's response shape (with project + RUN state). Read-only and
  bounded. Driven by the WS `scanTia {port}` → `scanResult {found,scanned,subnets}`
  messages (`server.ts`) and the Online menu's **Search network** button.
- `gateway/src/links.ts` — tag-link bridge (`config.links`): routes one
  adapter's published tag into another's write. Change-driven (adapters
  republish every poll — forwarding those would hammer targets), values are
  coerced to the target's dataType, failed writes log ONCE then retry
  silently, bad links are dropped at startup with a warning. This is what
  closes the loop between the TIA PLC and machine models.
- `gateway/src/adapters/conveyor.ts` — conveyor MACHINE MODEL (plant behavior
  on the bus, no external device): ~30 Hz tick, parts advance at
  `minSpeed + speedCmd*(maxSpeed-minSpeed)` while `motorCmd`, auto feeder
  every `autoFeedS` s (+ momentary `feed`), `photoEye` true while a part is
  in the eye zone (dwell = eyeWidth/speed — keep ≥ a few PLC scans),
  `part<N>Pos` = −1 when the slot is empty (bindings can park the mesh).
  Closed-loop test: `scripts/conveyor-loop-probe.mjs` — presses Start through
  the gateway, then asserts the plant runs the PLC's counter with NO client
  writing sensors.
- `gateway/src/adapters/press.ts` + `mixer.ts` — machine-model ports of the
  protocol sims (`s7-plc-sim.mjs` / `opcua-server-sim.mjs`) with identical
  dynamics; lags are tick-rate independent (`1 - (1-k)^(dt/0.1)` reproduces
  the sims' per-100 ms factors). Extra PLC-facing sensors: press
  `atTop`/`atBottom`/`pressing`; mixer `batchDone` (0.6 s pulse — long enough
  for a polled PLC), `batchProgress`, `overTemp`. Smoke test:
  `scripts/machines-probe.mjs` (gateway only; asserts stroke/pressure/cycle
  dynamics and slosh/batch/thermal dynamics through the WS).
- `gateway/src/adapters/memory.ts` — virtual tags, no device: all writable, a
  write publishes straight back; 2 s heartbeat so widgets bound to quiet tags
  don't dim as stale. This is "soft wiring": bind machine A's sensor OUTPUT
  and machine B's actuator INPUT to the same `virtual.*` tag and they couple
  through the bus with no PLC and no `links` entry (the sorting-line sample
  runs on `virtual.b1`). Config: `{ type:'memory', id, tags:[{name, dataType,
  initial?}] }` — default entry `virtual` (b1…b4 bool, n1/n2 number).
- `gateway/src/adapters/s7.ts` — Siemens S7comm via pure-JS nodes7 (typings
  in `src/types/nodes7.d.ts` — no @types package). Polled like Modbus;
  nodes7 converts REAL/INT/X-bit types. Fresh NodeS7 instance per connect
  (internal state unreliable after connection loss). Offline detection ~10 s
  (3 strikes × nodes7 read timeout). Test server:
  `gateway/scripts/s7-plc-sim.mjs` (snap7 server, native dev-dep node-snap7;
  DB map in header; first connect after server start can transiently fail —
  the retry loop absorbs it).
- `frontend/src/bindings/` — types.ts (Binding/TransformSpec/Project +
  applyTransform), engine.ts (per-frame applier; per-node euler state so
  multi-axis rotation bindings compose; problems surfaced via getProblem).
- `frontend/src/machines/` — the physics machine library. `types.ts`:
  `MachineInstance` {id,kind,name,x,z,rotY,params,tags} + `MACHINE_CATALOG`
  (per-kind params schema + tag slots; `paramsOf()` merges saved params over
  defaults so old saves survive new params). `physics.ts`: Havok WASM init
  (`initScenePhysics`, graceful `physicsReady()=false` fallback — machines
  still render, parts disabled) + body helpers; the ground gets an INVISIBLE
  BOX SLAB collider (`ground-collider`) because a zero-thickness ground plane
  makes a degenerate box shape. `boxes.ts`: BoxManager (spawn/cap-60/cull
  y<−4/consume; parts get `setAngularDamping(0.6)` so corner landings don't
  kick them off the belt). `rigs.ts`: one Rig per kind = meshes + physics +
  per-frame behavior (`buildRig` factory; roots named `machine:<id>`, children
  `machine:<id>:part` — the panel maps viewport picks back via that prefix).
  `engine.ts`: MachineEngine — diffs `project.machines` by JSON so unrelated
  project edits rebuild nothing, ticks rigs `onBeforeRender` (dt clamped
  50 ms), owns gestures (Shift+click = drop part at pick; arrange mode = drag
  machine on the y=0 plane, camera detached during drag, commit-on-release →
  that machine alone rebuilds at the new spot), and `EngineIO` (reads from
  TagStore; writes change-deduped so 60 fps sensors send one message per edge,
  dedupe cache cleared every 2 s so state re-asserts after a runtime restart).
  Testing hook: `__SIM__.machineEngine.debug()` → {physics, machines, parts}.
  Round 5 — PROCESS SIM: `machines/fluids.ts` FluidNet = lumped tank volumes
  in liters (no particles; dV/dt = ΣQin − ΣQout per tick gives clean PID
  dynamics). Tanks `register()` (re-registering KEEPS the water — that's why
  tankRig.dispose does NOT unregister; the ENGINE unregisters only on machine
  removal, same split as `manual`), pseudo-endpoints `supply` (1.5 m constant
  head) / `drain` (0 m). take/add clamp (empty source starves a pump;
  deadheaded flow returns to the source). Pump Q = maxFlow·run·speed %;
  valve Q = maxFlow·open·position %·√(ΔH/1 m), one-way (check valve).
  `EngineIO.writeNum` (0.1-quantized dedupe + the 2 s flush) carries tank
  `level %` and pump/valve `flow L/s` to writable number tags. ParamSpec type
  'machine' (+`machineKinds`/`extras`) renders a connection dropdown in the
  panel (From/To; stale ids shown "(missing)" and reported as problems).
  Piping is AUTO-ROUTED (`flowPiping` + CreateTube runs, world-space,
  unparented, disposed by the rig): suction from the tank base / supply
  riser, discharge up-and-over the destination rim / drain stub; a per-tick
  key over connected tanks' x/z/height redraws pipes when a tank moves or
  registers late (build order). Manual overrides: pump run+speed, valve
  open+position (speedRow is parametrized by key). E2E proof: TIA ladder
  P-controller (unconditional MOVE/SUB/MUL rungs on Int %MW words) holds tank
  level vs a √-head drain — settles ~54 % for SP 60 (P-droop) and rejects a
  doubled load.
  Round 4 — MANUAL OVERRIDES: `MachineEngine.manual` is a runtime-only
  Map<machineId, Record<key, bool|number>> (the relay-test-button / PLC-force
  analog; never persisted; survives rig rebuilds because it's id-keyed;
  cleared on machine removal). Rigs get `deps.manual(id)` and check it BEFORE
  tag bindings: conveyor/curve `motor`+`speed`(%), turntable `rotate`+`speed`,
  pusher `extend`, gate `raise`, photo-eye `blocked` (forces the sensor — its
  tag really writes), stacklight `test` (solid, bypasses blink). Bins expose
  `Rig.action('reset')` via `engine.runAction`. Engine API: manualState /
  setManual(id,key,val|undefined=Auto) / hasManual / runAction; debug() lists
  overridden ids. machinePanel renders a per-kind "Manual override" section
  (3-state seg buttons + speed checkbox/slider + reset), rows show a ✋ badge
  while overridden; roles: `machine-manual[data-key]` (buttons carry
  data-val true/false/undefined), `machine-manual-speed[-on]`,
  `machine-reset-count`. Speed tag slots (conveyor/curve/turntable) read ANY
  numeric tag as 0–100 % — TIA Int/Word/Real all arrive as dataType 'number'
  via the tiaweb adapter, so ladder `MOVE n → %MW` drives belt speed (E2E
  verified: MOVE 30/90 → ~3× physical speed ratio).
  Round 3: `turntable` — ANIMATED cylinder disc (physics helpers take a
  'box'|'cylinder' shape arg); unbound = carousel, `rotate` tag = 0°↔`angle`
  indexing with atHome/atEnd writes; parts are carried by blending their
  velocity toward ω·(dz, −dx) (the disc's yaw-rate field) + setAngularVelocity
  so they turn with it — when the disc parks, NOTHING drives or brakes parts
  (low friction ⇒ they coast/slide a bit on abrupt stops; that's intended so
  belts can hand parts across a parked table). `stacklight` — R/A/G lamp
  cylinders, emissive on tag true, optional 1 Hz blink, 'no lamp tags bound'
  problem when fully unbound. SNAPPING: `machinePorts(m)` (types.ts) returns
  entry/exit world points + flow yaw for conveyor/curve (incline-aware Y);
  `MachineEngine.trySnap` runs during arrange moveDrag — nearest in↔out port
  pair within 0.35 m and ≤0.12 m height difference solves rotY (yaw delta) +
  position (ports coincide), previewed live on the root and committed
  (incl. rotY) at endDrag. Yaw convention everywhere: node world +X =
  (cos β, 0, −sin β), so a direction's world yaw = local yaw + rotY.
  Round 2: conveyors take `rise` (belt/rails/rollers under a PITCHED `frame`
  sub-node whose origin is the top-surface center — contact math + drive run
  in frame space, legs stay vertical under root with per-end heights) and
  `rails` (both|left|right|none; left = −z); `curve` kind = segmented arc
  (entry at origin heading +X, center at (0,·,s·R), N≈|A|/15° box segments,
  analytic contact by radius band + angle range, drive along the tangent at
  the part's own arc angle). Photo-eye `detect:'color'` sees only
  `BoxPart.colored` (accent palette indices ≥ 4 in boxes.ts). Mouse grab:
  pointerdown on a `part:` mesh (precedence: shift-drop > part grab > arrange
  drag) spring-steers the dynamic body toward cursor∩(horizontal plane at
  grab height) via setLinearVelocity (gain 10, cap 8), release keeps capped
  momentum → throw; camera detached during, reattached after.
  PHYSICS GOTCHAS (cost us real debugging): (1) do NOT drive belt parts with
  `applyImpulse` — the static belt collider's friction pins resting parts
  (stick-slip: reported velocity ~0.3 with frozen position); blend the
  along-axis component via `setLinearVelocity` instead (`blendAlong`), and
  keep the belt collider friction LOW (0.15) — transport + braking come from
  the velocity blend. (2) `setLinearVelocity` also moves a deactivated
  (sleeping) part, so a restarted belt picks sleepers back up; this Babylon
  version has no `PhysicsBody.setActivationControl`. (3) kinematic movers
  (pusher head, gate blade) = aggregate mass 0 + `PhysicsMotionType.ANIMATED`
  + `disablePreStep=false` so the body follows the mesh each step — BUT
  kinematic contact barely transfers momentum: the pusher additionally hands
  parts at its face the ram's velocity while extending (same setLinearVelocity
  pattern), else parts topple off a belt edge instead of launching clear.
  (4) `staticBody()` must run AFTER the root transform is final
  (`computeWorldMatrix(true)` before creating the aggregate).
- `frontend/src/machinePanel.ts` — Machines panel UI: catalog add row, arrange
  toggle (`engine.arrangeMode`), Drop part / Clear parts, instance list with
  1 s status/⚠-problem refresh (labels only), properties editor (placement,
  params by ParamSpec, tag selects filtered by slot dataType + writability).
  Commits DON'T re-render (a `muted` flag suppresses the store echo so inputs
  keep focus) — therefore every input closure re-reads the live machine via
  `cur()` before spreading, else editing X then Z would commit Z over a stale
  X. Inputs commit on `change` (blur/Enter), not per keystroke — each commit
  rebuilds that machine's rig. Viewport selection with a `machine:` prefix
  selects the machine here too. `data-role`s: `machine-kind-select`/
  `machine-add`/`machine-arrange`/`machine-drop`/`machine-clear`/
  `machine-row[data-machine]`/`machine-remove`/`machine-name`/`machine-x`/
  `machine-z`/`machine-rot`/`machine-turn`/`machine-prop[data-key]`/
  `machine-tag[data-slot]`/`machine-dropnow`.
- `frontend/src/` — scene.ts (setup + GLB load only), projectStore.ts
  (localStorage + defaults; `.export()`/`.replace()` back the File menu),
  bindingPanel.ts (editor UI), sceneTree.ts + viewportSelection.ts (picking;
  engine needs `{ stencil: true }` for the HighlightLayer), tagStore.ts,
  tagTable.ts, wsClient.ts.
- Panel layout: the two fixed side columns (`#panels` right, `#panels-left`
  left) scroll vertically (CSS `overflow-y:auto` + `max-height`), so a tall
  panel stack no longer runs off-screen. `panel.ts` bodies are
  `resize: vertical` (corner grip → taller/shorter, content scrolls inside)
  and persist a user-set height per title (a ResizeObserver saves
  `body.style.height` only when it's a non-empty inline value, i.e. set by a
  manual drag, not content growth). `frontend/src/layout.ts` (`initLayout()`,
  called last in main.ts) adds a `.col-resize-handle` per column that drags
  the whole column's width, clamped [220,640], persisted to
  `layout:panels:w` / `layout:panelsLeft:w`; handles are `position:fixed` and
  kept glued to the column edge via a ResizeObserver + window resize.
  `data-role="col-resize-left|right"` for headless testing. (Headless caveat:
  `Page.captureScreenshot` composites the live WebGL canvas OVER these
  semi-transparent fixed overlays, so panels look absent in screenshots —
  they're really there; hit-test with `elementFromPoint` to confirm.)
- `frontend/src/fileMenu.ts` — the `#topbar` **File** dropdown: New / Open /
  Save project as JSON, in addition to (not instead of) the localStorage
  autosave every `ProjectStore` mutation already does. Also **samples**: the
  `SAMPLES` const lists bundled projects under `frontend/public/samples/`
  (fetched over vite, validated, confirm() then replace+reload —
  `data-role="file-sample-sorting"` for the sorting line). Save downloads
  `ProjectStore.export()` via a Blob URL; Open reads a picked file, validates
  its shape, then `ProjectStore.replace()`s it. Both New and Open confirm()
  first (destructive — they replace the whole project) and `location.reload()`
  after, because bindings react to project changes live but panels/widgets/
  alarms don't — a bulk replace needs a fresh boot to render cleanly
  everywhere. Elements carry `data-role` (`file-menu`, `file-menu-trigger`,
  `file-new`/`file-open`/`file-save`) for headless testing. Gotcha: the
  dropdown's `hidden` attribute only hides it if no author CSS sets `display`
  on the same selector without a `[hidden]` override — see the
  `.file-menu-dropdown[hidden]` rule in `index.html`.
- `frontend/src/onlineMenu.ts` — the `#topbar` **Online ▾** dropdown, a
  multi-PLC connection manager: lists every `tiaweb` adapter
  (`store.adapters.filter(type==='tiaweb')`, polled every 500 ms) as a row with
  its id, url, online/RUN dot, and Edit/Remove; plus an add/edit form (a
  connection **name** + host:port) with Test (`conn.testTia()`, changes
  nothing) and Connect (`conn.connectTia(id, url)`, hot-swaps/creates live).
  Remove (`conn.removeTia(id)`, confirm-guarded) drops a connection and its
  tags. `suggestId()` pre-fills an unused name (`tia`, `tia2`, …); the id field
  locks when redirecting an existing connection. `normalizeUrl()` prepends
  `http://` if no scheme was typed. Also a **Search network** control (a port
  field + button → `conn.scanTia(port)`) that lists found runtimes; clicking a
  hit's **Use** drops its url (+ a suggested id) into the form. `data-role`
  attrs (`online-list`, `online-id-input`/`online-url-input`,
  `online-test`/`online-connect`, `online-conn-row[data-conn]`,
  `online-edit`/`online-remove`, `online-search`/`online-scan-port`/
  `online-scan-use`) for headless testing. Same `.online-menu-dropdown[hidden]`
  CSS gotcha as the File menu.
- `frontend/src/trendPanel.ts` — the **Trends** panel: pick numeric/boolean
  tags from a dropdown, each rendered as a compact `<canvas>` sparkline over a
  rolling window (30s–5m). Own ring buffers sampled from the tag store every
  250 ms (decoupled from update rate); numeric → auto-scaled line + area fill +
  endpoint dot, boolean → step line; a hover crosshair reads the value at a
  point back into the row's label. `wanted` (a Set) is the persisted source of
  truth (`trend:selected`); rows `materialize()` lazily once each tag's meta
  arrives (the gateway `hello` may land after construct — this is why a
  persisted selection survives reload). Single series per chart → no legend,
  one accent hue. `data-role="trend-add"`, `.trend-win-btn[data-win]`,
  `.trend-row[data-tag]` for testing.
- Write path: browser sends `{type:'write', tagId, value}` → server →
  `bus.write` → owning adapter's `write()`; confirmed values return via the
  normal update stream, rejections via `writeError`. Tags opt in with
  `writable: true` on TagMeta.
- `frontend/src/widgets.ts` + `controlPanels.ts` — widget library (switch,
  momentary button, knob, LED, gauge) and the panel manager (per-panel ✎ edit
  mode, widgets stored in `project.panels`).
- Polish-phase modules: `connectionsPanel.ts` (adapter health, LWT device
  dots; a per-adapter **⟳** button when `adapter.canRefreshTags` calls
  `conn.refreshTags(id)` and tracks its own busy/error state per adapter,
  independent of the panel's 500 ms poll-driven re-render), `alarmsPanel.ts`
  (rules live in `project.alarms`, evaluated
  client-side at 300 ms), `replayPanel.ts` (recorder hooks `store.onApply`;
  replay sets `store.livePaused` so wsClient drops live messages), `ui.ts`
  (shared DOM builders). Binding engine captures per-property baselines and
  restores them when a binding is removed (`baselines` map, key
  `<node>|<property-group>`; rotation axes share one baseline).
- Testing hook: `window.__SIM__` exposes { scene, store, projectStore,
  bindingEngine, conn, alarmsPanel, replayPanel } after scene load. Editor
  controls carry `data-role` attrs; binding rows carry `data-binding-id`;
  widgets carry `data-widget-id` + `data-tag`; replay panel root carries
  `data-replay` state.
- **The 3D model is optional.** `Project.modelUrl` is `string | null`; the
  default project is machines-only (`null`) and `createScene` skips
  `AppendSceneAsync` when it is null. The **Scene** and **Bindings** panels
  exist only to serve an imported GLB, so `main.ts` creates them hidden and
  reveals them after load only when `sceneTree.names().length > 0`. The old
  demo robot arm (`/models/demo-arm.glb` + its generator + `sim.armAngle` /
  `sim.forearmAngle`) is gone; `ProjectStore.load()` migrates saved projects
  that still point at it (clears `modelUrl`, drops the dead arm bindings).

## Environment notes

- Port 8081 is taken by a Java process on this machine — gateway uses 8082
  (`DEFAULT_GATEWAY_PORT` in shared).
- Headless browser checks: use Playwright's cached
  `~/.cache/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell`
  with `--enable-unsafe-swiftshader` (software WebGL). `--dump-dom
  --virtual-time-budget=N` works for one-shot asserts; `--timeout=N` dumps at
  load event, NOT after N ms — for timed observation drive CDP via
  `--remote-debugging-port`. Havok WASM loads fine headless. For screenshots
  use CDP `Page.captureScreenshot` (canvas content renders; DOM overlays may
  composite away — see above) — `canvas.toDataURL()` comes back BLANK because
  the engine doesn't use `preserveDrawingBuffer`. When driving viewport
  gestures with `Input.dispatchMouseEvent`, pre-check
  `document.elementFromPoint(x,y)?.id === 'renderCanvas'` — `scene.pick`
  raycasts straight through the fixed panel overlays, so a pick-scan can find
  a mesh at a pixel where the synthetic mousedown would actually land on a
  panel div and never reach Babylon.
- Headless renders at ~5 fps (swiftshader) and `MachineEngine`'s tick clamps
  `dt` to 0.05 s/frame, so **sim-time advances ~4x slower than wall-clock**.
  Anything on a timer (the 6 s part dropper, tank fills) needs generously
  polled waits, not fixed sleeps sized for real time.
- Chromium reuses its profile across CDP pages, so `localStorage` (the saved
  project) leaks between test passes — `localStorage.clear()` + reload at the
  start of any pass that expects the default project.
- HUD exposes `data-ws-status` / `data-scene`; table rows expose `data-tag`
  attributes — use these for headless assertions.

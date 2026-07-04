# Automation Sim — agent guide

Browser-based real-time 3D hardware telemetry: Babylon.js frontend, Node.js
gateway that normalizes device protocols into one WS tag stream. Roadmap and
current phase live in README.md — follow that order.

## Commands

```bash
npm run dev                      # fake PLC (5020) + gateway (ws://localhost:8082) + vite (http://localhost:5173)
npm run typecheck                # all workspaces
npm run glb                      # regenerate frontend/public/models/demo-arm.glb
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
  autosave every `ProjectStore` mutation already does. Save downloads
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

## Environment notes

- Port 8081 is taken by a Java process on this machine — gateway uses 8082
  (`DEFAULT_GATEWAY_PORT` in shared).
- Headless browser checks: use Playwright's cached
  `~/.cache/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell`
  with `--enable-unsafe-swiftshader` (software WebGL). `--dump-dom
  --virtual-time-budget=N` works for one-shot asserts; `--timeout=N` dumps at
  load event, NOT after N ms — for timed observation drive CDP via
  `--remote-debugging-port`.
- HUD exposes `data-ws-status` / `data-scene`; table rows expose `data-tag`
  attributes — use these for headless assertions.

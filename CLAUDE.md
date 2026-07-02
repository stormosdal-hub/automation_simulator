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
```

## Architecture

- `shared/src/index.ts` — the message schema (hello / tagUpdate). Change here
  first; both sides import `@sim/shared` (TS source, no build step).
- `gateway/src/bus.ts` — TagBus: adapters publish in, subscribers fan out;
  keeps latest value per tag for hello snapshots.
- `gateway/src/adapter.ts` — Adapter contract. New data sources (OPC UA,
  MQTT, …) implement this; instances are declared in `gateway/config.json`
  and constructed in `gateway/src/index.ts`. Tag ids are `<adapterId>.<name>`,
  unique per gateway. Convention: every network adapter publishes
  `<adapterId>.online` (boolean) as a bindable health tag.
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
  (localStorage + defaults), bindingPanel.ts (editor UI), sceneTree.ts +
  viewportSelection.ts (picking; engine needs `{ stencil: true }` for the
  HighlightLayer), tagStore.ts, panel.ts, tagTable.ts, wsClient.ts.
- Write path: browser sends `{type:'write', tagId, value}` → server →
  `bus.write` → owning adapter's `write()`; confirmed values return via the
  normal update stream, rejections via `writeError`. Tags opt in with
  `writable: true` on TagMeta.
- `frontend/src/widgets.ts` + `controlPanels.ts` — widget library (switch,
  momentary button, knob, LED, gauge) and the panel manager (per-panel ✎ edit
  mode, widgets stored in `project.panels`).
- Polish-phase modules: `connectionsPanel.ts` (adapter health, LWT device
  dots), `alarmsPanel.ts` (rules live in `project.alarms`, evaluated
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

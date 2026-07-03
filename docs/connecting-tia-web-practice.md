# Connecting TIA Web Practice to Automation Sim

Two sibling projects, one loop: author ladder/FBD logic and run it on
`plc_server.py` (the TIA Web Practice runtime), then let this gateway read and
drive its tags — either to animate the 3D scene, or to run a fully virtual
plant with no hardware at all.

Everything below works two ways: **simulation-only** (nothing but your
machine — the recommended starting point) and **with a real Raspberry Pi**
wired to actual I/O. The two paths diverge at exactly one step (§3); everything
else is identical.

```
TIA Web IDE  --download/monitor (HTTP)-->  plc_server.py  <--poll /api/state, force /api/force (or Modbus TCP)-->  gateway  --WS tag stream-->  3D scene + panels
 (browser)                                 (Python runtime)                                                        (TagBus, tag links,          (browser :5173)
                                            HTTP :8000 +                                                            conveyor/press/mixer)
                                            optional Modbus TCP
```

The gateway itself can be the plant: its `conveyor`/`press`/`mixer`
machine-model adapters simulate real belt/press/mixer physics on the bus, and a
**tag-link bridge** wires their sensors straight back into the PLC's inputs —
so the loop closes with zero external hardware. See [§7](#7-close-the-loop--no-hardware-ever).

**TIA and the gateway don't need to be the same machine.** The runtime binds
every network interface and its API is plain HTTP with open CORS, so the
gateway just needs a reachable `host:port` — same box, another computer on
your LAN over WiFi/Ethernet, or a Raspberry Pi. Point the **Online ▾** menu
(or `config.json`, §4) at that address either way.

## Contents
1. [Prerequisites & repo layout](#1-prerequisites--repo-layout)
2. [Get a PLC program running](#2-get-a-plc-program-running)
3. [Choose a path](#3-choose-a-path)
4. [Point the gateway at the runtime](#4-point-the-gateway-at-the-runtime)
5. [Start everything](#5-start-everything)
6. [Verify the link](#6-verify-the-link)
7. [Close the loop — no hardware, ever](#7-close-the-loop--no-hardware-ever)
8. [Bring it into the 3D scene](#8-bring-it-into-the-3d-scene)
9. [Troubleshooting](#9-troubleshooting)
10. [Command cheat-sheet](#10-command-cheat-sheet)

## 1. Prerequisites & repo layout

Both projects assume they live as **sibling directories** — the gateway's
`tia-sim` script and default `config.json` both point at
`../TIA_Portal_Web-app` relative to `automation_sim/`:

```
~/
├── TIA_Portal_Web-app/     # the PLC IDE + plc_server.py + plc_engine.py
└── automation_sim/         # gateway/, frontend/, shared/
```

- **Python 3** — stdlib only on the TIA side, nothing to install for simulation.
- **Node.js 22 + npm** — for the gateway/frontend (`npm install` once, from `automation_sim/`).
- Real Pi only: `gpiozero` (`sudo apt install python3-gpiozero`) and network
  reachability between the Pi and whatever machine runs the gateway.

## 2. Get a PLC program running

You need a program in the TIA app whose tag **names** the gateway already
knows about. The shipped demo, `Conveyor_Demo` (loads automatically), matches
the gateway's built-in `tia` adapter entry out of the box:

| Tag | Type | Role |
|---|---|---|
| `Start_PB` | Bool | writable — seals in the motor |
| `Stop_PB` | Bool | writable — drops the motor |
| `Part_Sensor` | Bool | writable — fed by the virtual conveyor's photo-eye |
| `Motor` | Bool | read-only — drives the conveyor's `motorCmd` |
| `Run_Lamp` | Bool | read-only — TON(3s) after Motor |
| `Count_Done` | Bool | read-only — sets at Part_Count ≥ 5 |
| `Part_Count` | Int | read-only — CTU on Part_Sensor |
| `Conveyor_PWM` | Real 0–1 | read-only — NORM_X duty, drives conveyor speed |

Writing your own program instead? Nothing to configure — the gateway
**discovers every declared tag automatically** (§4), so whatever you name
your tags is what shows up as `tia.<name>` on the bus.

> **Two different ways to open the app matter here.** Double-clicking
> `index.html` gives you a pure offline simulator with no server behind it —
> fine for designing logic, but there's nothing for the gateway to talk to. To
> integrate, open the app **at the runtime's own URL**
> (`http://localhost:8000`, once `plc_server.py` is running — §3) and use the
> **Online (PLC)** toolbar group: **Connect → Download → PLC → Monitor**.
> That's what actually loads your program into the process the gateway polls.

## 3. Choose a path

Both paths run the exact same `plc_engine.py` interpreter — verified
bit-for-bit identical to the in-browser simulator by parity tests. The only
difference is what backs the I/O.

### Simulation only (no hardware)

Tags with no GPIO mapping are just internal memory — `--mock` forces the
pure-Python I/O backend so nothing touches real pins even if gpiozero happens
to be installed.

```bash
# TIA_Portal_Web-app — your machine
python3 plc_server.py --mock
```

Or let the gateway start it for you (same command, run from the sibling
checkout automatically):

```bash
# automation_sim/gateway
npm run tia-sim -w @sim/gateway
```

Skip GPIO mapping entirely. Every input (`Start_PB`, `Part_Sensor`…) gets
driven by the gateway's writes instead of a physical switch.

### Real Raspberry Pi (with hardware)

On the Pi:

```bash
sudo apt install python3-gpiozero
python3 plc_server.py
```

(no `--mock` — gpiozero is auto-detected; Pi 5 uses gpiozero/lgpio, not
RPi.GPIO)

In the TIA app's **Raspberry Pi → Export Python** screen (or the Online pin
table), map each Bool tag to a BCM pin — inputs (`I`) become GPIO inputs,
outputs (`Q`) become GPIO outputs. Give `Conveyor_PWM`-style analog tags a
**pwm** direction + frequency; unmapped tags stay internal memory, exactly
like the simulation path.

> The gateway now needs the Pi's **LAN address**, not `127.0.0.1` — see §4.
> Make sure the chosen port is reachable through any firewall between the Pi
> and whatever machine runs the gateway.

## 4. Point the gateway at the runtime

Two ways to do this — pick whichever fits. Both end up in the same place.

### The Online menu (no config.json editing)

Start the gateway with no `tia` adapter configured at all (or leave the
shipped one — connecting overrides it live). Open the frontend
(`http://localhost:5173`), click **Online ▾** in the topbar, and type the
runtime's address:

- Same machine: `127.0.0.1:8000` (or just `localhost:8000`)
- **Another computer on your network** — a Raspberry Pi, a different desktop
  over WiFi or Ethernet: that machine's IP, e.g. `192.168.1.50:8000`

Click **Test connection** first — it probes `/api/info` and confirms it's
actually a TIA Web Practice runtime before anything changes. Click **Connect**
and the gateway hot-swaps to it immediately: no restart, no page reload, tags
discovered fresh from whatever program is running there. A bad address is
rejected without touching whatever's currently connected, so you can safely
try an address and fall back if it's wrong. This is genuinely a different
physical machine at that point — the gateway just needs to reach that IP:port
over the network (LAN, WiFi, doesn't matter), the same way any other HTTP
client would.

### config.json (a fixed default, no clicking required)

Edit `automation_sim/gateway/config.json` if you'd rather the connection
already be there every time the gateway starts — no tag list to maintain,
since the adapter discovers every declared project tag from `GET /api/tags`
the moment it connects:

```json
{ "type": "tiaweb", "id": "tia", "url": "http://127.0.0.1:8000", "pollMs": 100 }
```

For a real Pi (or any other machine), change only the `url`:
`"url": "http://192.168.x.x:8000"` — that machine's own address on your
network. Want to curate a subset instead of publishing everything? Add an
explicit `"tags": [...]` array (`{name, dataType: "boolean"|"number",
writable}` per tag) — this also disables the **⟳** refresh button and the
Online menu's Connect (a target with explicit tags is a deliberate, curated
list; reconnecting live always re-discovers everything fresh, which would
undo that curation, so it's skipped in that mode).

### Either way: refresh after editing tags

Whichever way you connected, discovery only runs once (at startup, or at the
moment you click Connect) — but you don't need to restart anything to pick up
*later* edits. Add, rename, retype, or delete tags in the TIA app, download
the updated program, then click the **⟳** button next to the `tia` row in the
**Connections** panel (frontend, top-right by default): the gateway
re-imports the tag list on the spot and every connected browser updates
immediately. New tags appear, edited ones (name/type/comment) update in
place, and removed ones simply stop updating — no gateway restart, no page
reload.

### Two ways to reach the runtime over the wire — pick one per tag set

The `tiaweb` adapter above (HTTP) is the default and needs no extra flags. The
runtime can *also* speak plain **Modbus TCP** (`plc_server.py --modbus-port
5020`), which means the gateway's existing, protocol-generic `modbus` adapter
— the same code that already talks to the Modbus demo PLC on port 5020 —
works against it unchanged. Reach for Modbus when you want the TIA runtime to
look like *any* real PLC to SCADA/HMI tooling, not just this gateway.

| Modbus table | 0 – 9999 | 10000 – 19999 |
|---|---|---|
| Coils (FC01, FC05/0F) | `M` bit | `Q` bit |
| Discrete Inputs (FC02) | `I` bit | — |
| Holding Registers (FC03, FC06/10) | `M` word | `Q` word |
| Input Registers (FC04) | `I` word | — |

`GET /api/modbus-map` on the runtime lists the derived `{kind, address}` for
every tag with an `%I/%Q/%M` address, so you don't compute the mapping by
hand. Don't point both a `tiaweb` adapter *and* a `modbus` adapter at the same
tags from the same gateway — pick one write path per tag to avoid two masters
racing the same memory cell.

## 5. Start everything

```bash
# terminal 1 — TIA_Portal_Web-app (skip if using a real Pi, or run there instead)
python3 plc_server.py --mock
```

```bash
# terminal 2 — automation_sim
npm install                 # once
npm run dev                  # gateway :8082 + frontend :5173
```

Then open **http://localhost:8000** to work the PLC (Connect → Download →
Monitor, per §2) and **http://localhost:5173** for the 3D scene. On the Pi
path, terminal 1 runs on the Pi instead — everything else is identical.

## 6. Verify the link

Shipped smoke tests exercise the whole path end-to-end with a real gateway and
a real (mock) runtime — no browser needed:

| Command | Checks |
|---|---|
| `npm run tia-probe -w @sim/gateway` | downloads a seal-in + counter program, drives it through the gateway's WS, checks writeError + offline handling |
| `npm run tia-loop-probe -w @sim/gateway` | closed-loop: presses Start once, asserts the conveyor + PLC counter run with *zero* further client writes (~30 s) |
| `npm run machines-probe -w @sim/gateway` | press + mixer machine-model dynamics only, no TIA runtime needed (~35 s) |

`tia-probe`/`tia-loop-probe` expect the gateway on port **8092** to avoid
clashing with an already-running `npm run dev`:
`GATEWAY_PORT=8092 npm run start -w @sim/gateway` in one terminal, the probe in
another, both alongside `npm run tia-sim -w @sim/gateway`.

Manual check: `curl http://localhost:8000/api/info` should report
`"hasProgram": true` once you've downloaded a program; the frontend's HUD
(top-left) shows `tia.online` turning green once the gateway's first poll
succeeds.

## 7. Close the loop — no hardware, ever

This is the part that needs neither a Pi nor any physical sensor. The gateway
ships three **tag links** that wire the PLC directly to a simulated conveyor:

```json
"links": [
  { "from": "tia.Motor",        "to": "conv.motorCmd" },
  { "from": "tia.Conveyor_PWM", "to": "conv.speedCmd" },
  { "from": "conv.photoEye",    "to": "tia.Part_Sensor" }
]
```

Press `Start_PB` once (from the TIA simulation table, or a 3D-scene button —
§8) and the rest happens on its own: the seal-in latches `Motor`, the link
drives the virtual belt, parts ride past its photo-eye, the link feeds that
back into `Part_Sensor`, the ladder's `CTU` counts it, and `NORM_X`'s duty
output speeds the belt up as the count climbs. A complete
virtual-commissioning loop — the plant is the gateway's `conveyor` adapter,
not a wire.

The `press` and `mixer` machine-model adapters work the same way — add tags
for their `runCmd`/`atTop`/`batchDone` etc. to the `tia` adapter's tag list and
link them, and you have a hydraulic press or a mixing skid your ladder logic
can run, with zero hardware.

## 8. Bring it into the 3D scene

Open **http://localhost:5173**. Use the scene tree + binding editor to bind a
mesh's transform or material to a tag — e.g. `conv.beltSpeed` driving
belt-texture scroll speed, `tia.Run_Lamp` driving a lamp material's emissive
color. Writable tags (`tia.Start_PB`, `tia.Stop_PB`) can be wired to a
control-panel widget (button, switch, knob) so the 3D scene itself operates
the real ladder logic — press the on-screen button, watch the seal-in rung go
live in the TIA app. The full binding editor walkthrough lives in the main
[`README.md`](../README.md).

Once you've built up bindings, panels, and alarms, use the **File** menu
(top-left) to save this scene's own project — a *different* file from the TIA
ladder program: **Save project as…** downloads a JSON snapshot of the
bindings/panels/alarms/model you just built, **Open project…** loads one back
in, and **New project** clears the current one (the 3D model stays loaded).
Both New and Open replace the project and reload the page. This was
localStorage-only before — the File menu adds real files you can back up or
hand to someone else, on top of the autosave that already runs on every edit.

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `tia.online` stays false | Wrong `url` in config.json (or you haven't connected via the Online menu yet), runtime not started, or a firewall between gateway and Pi. The adapter fails safe — it keeps polling and flips online after 3 failures, no restart needed once fixed. |
| Online menu's **Test connection** fails | The address is unreachable (wrong IP/port, runtime not started, firewall) or something else is answering on that port — the check specifically verifies the response looks like a TIA Web Practice `/api/info`, not just "something responded". |
| **Connect** fails but the previous connection still works fine | That's by design — a failed connect attempt never tears down a working one. Fix the address and try again. |
| Gateway logs "tag discovery failed" and only publishes `tia.online`/`tia.running` | The runtime wasn't reachable *yet* when the gateway started (discovery only runs automatically once, at startup) — start `plc_server.py`, then either click **⟳** in the Connections panel or reconnect via the Online menu, no restart needed. |
| Bindings reference a `tia.*` tag that never appears | You edited the ladder program after the last discovery — click **⟳** next to the `tia` row in the Connections panel to re-import live. |
| **⟳** button (or Online menu's Connect) doesn't appear/work as expected | Refresh only applies to adapters with `canRefreshTags` — for `tiaweb` that means auto-discovery mode; if `config.json` gives it an explicit `tags` array, both are skipped (a curated list is deliberate, and reconnecting always re-discovers everything fresh, which would undo that). |
| Gateway logs "unknown tag name" (explicit `tags` config only) | A tag in config.json doesn't exist in the downloaded program yet (common right after startup, before you've hit Download → PLC), or a name typo — tag names are exact-match. |
| Port 8082 already in use | `DEFAULT_GATEWAY_PORT` in `shared` is 8082 (8081 is often taken by unrelated Java processes) — override with `GATEWAY_PORT=<port>`. |
| Pi: `gpiozero` import errors | Pi 5 needs the `lgpio` pin factory, not RPi.GPIO — `sudo apt install python3-gpiozero` pulls the right backend; `--mock` always works regardless of hardware. |
| Modbus client gets exception code 2 (illegal address) | Address is outside the 0–19999 coil/holding bank or the tag has no `%I/%Q/%M` address at all — check `/api/modbus-map`. |
| Values flicker or fight each other | Both a `tiaweb` and a `modbus` adapter (or a link and a widget) are writing the same tag — pick one writer per tag. |

## 10. Command cheat-sheet

| Step | Simulation only | Real Raspberry Pi |
|---|---|---|
| Start the runtime | `python3 plc_server.py --mock` | `python3 plc_server.py` (on the Pi) |
| GPIO mapping | none — skip it | Raspberry Pi → Export Python, or the Online pin table |
| Gateway URL | `http://127.0.0.1:8000` (config.json or Online menu) | `http://<pi-lan-ip>:8000` (config.json or Online menu) |
| Start gateway + scene | `npm run dev` (from `automation_sim/`) | same |
| Smoke test | `npm run tia-probe -w @sim/gateway` | same |
| Optional: Modbus mode | `plc_server.py --modbus-port 5020`, gateway `modbus` adapter | same |

---

Deeper detail on either side: `TIA_Portal_Web-app/README.md` ("Online mode",
"Modbus TCP server mode") and this repo's `README.md` / `CLAUDE.md` (adapter
types, machine models, tag-link bridge).

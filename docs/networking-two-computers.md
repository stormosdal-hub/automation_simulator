# Running TIA Portal on a Raspberry Pi and Automation Sim on another computer

You want the **TIA Web Practice runtime** (`plc_server.py`) on a Raspberry Pi —
acting as the real PLC, optionally driving GPIO — and the **Automation Sim**
gateway + 3D scene on a separate computer, with the two talking to each other
over your LAN or Wi-Fi. This works out of the box: the runtime already listens
on every network interface, its API is plain HTTP, and the gateway just needs
the Pi's `host:port`. This guide walks the whole setup end to end.

```
   Raspberry Pi (192.168.1.50)                 Your PC / laptop (192.168.1.20)
 ┌───────────────────────────┐               ┌────────────────────────────────┐
 │  plc_server.py            │  HTTP :8000   │  automation_sim gateway :8082  │
 │  (TIA runtime + GPIO)     │◀─────────────▶│  + 3D scene (vite :5173)       │
 │  http://192.168.1.50:8000 │  /api/state   │  Online ▾ → 192.168.1.50:8000  │
 └───────────────────────────┘  /api/force   └────────────────────────────────┘
```

Both machines just need to be on the **same network** and able to reach each
other. Nothing here is Pi-specific except the commands — the "PLC" box could be
any Linux/Mac/Windows machine; the steps are the same, only the firewall/service
commands differ.

## Contents
1. [What runs where](#1-what-runs-where)
2. [On the Pi: start the runtime (reachable from the network)](#2-on-the-pi-start-the-runtime-reachable-from-the-network)
3. [Find the Pi's address](#3-find-the-pis-address)
4. [Open the port in the Pi's firewall](#4-open-the-port-in-the-pis-firewall)
5. [From the other computer: check you can reach it](#5-from-the-other-computer-check-you-can-reach-it)
6. [Load a PLC program onto the Pi](#6-load-a-plc-program-onto-the-pi)
7. [Connect the gateway to the Pi](#7-connect-the-gateway-to-the-pi)
8. [Keep the runtime running on boot (optional)](#8-keep-the-runtime-running-on-boot-optional)
9. [Troubleshooting](#9-troubleshooting)
10. [Security note](#10-security-note)

## 1. What runs where

| Machine | Runs | Why |
|---|---|---|
| **Raspberry Pi** | `plc_server.py` (from `TIA_Portal_Web-app`) | It's the PLC — interprets your ladder program and (optionally) drives GPIO. |
| **Your PC** | `automation_sim` gateway + 3D scene (`npm run dev`) | It's the SCADA/visualization — polls the Pi and shows the machine. |

You author the ladder logic in the **TIA Web app**, served *by the Pi* — you
open it in a browser (from either machine) at the Pi's address and Download the
program to the runtime. More on that in [§6](#6-load-a-plc-program-onto-the-pi).

> The roles are swappable — you could run the runtime on your PC and the gateway
> on the Pi — but Pi-as-PLC is the usual case, so that's what the commands below
> assume.

## 2. On the Pi: start the runtime (reachable from the network)

SSH into the Pi (or use its desktop terminal) and, in the `TIA_Portal_Web-app`
directory:

```bash
# with real GPIO hardware:
python3 plc_server.py

# no hardware yet, just testing over the network:
python3 plc_server.py --mock
```

That's it — **no special flag is needed to make it reachable**. The server binds
`0.0.0.0` (all network interfaces), so it already accepts connections from other
machines; `localhost`-only is never the case here. You'll see:

```
Open the app at:  http://localhost:8000
API base:         http://localhost:8000/api
```

(The `localhost` in that message is just for a browser *on the Pi* — from your PC
you'll use the Pi's network address instead, next step.)

Want the gateway to reach it over **Modbus TCP** as well (so any SCADA can
connect too)? Add a port:

```bash
python3 plc_server.py --mock --modbus-port 5020
```

## 3. Find the Pi's address

On the Pi:

```bash
hostname -I        # prints its IP address(es), e.g. 192.168.1.50
```

Take the first address on your LAN (usually `192.168.x.x` or `10.x.x.x`; ignore
`127.0.0.1` and any `172.17.x` docker addresses). Call it `PI_IP`.

Two ways to make this address stable so it doesn't change on reboot:
- **mDNS hostname** — Raspberry Pi OS answers to `raspberrypi.local` (or
  `<your-hostname>.local`) on most networks, so you can use that instead of the
  numeric IP everywhere below. Handy, but flaky on some Windows/enterprise
  networks — fall back to the IP if `.local` doesn't resolve.
- **DHCP reservation / static IP** — reserve the Pi's IP in your router's DHCP
  settings (by its MAC address) so it's always the same. Most robust.

## 4. Open the port in the Pi's firewall

If the Pi has a firewall enabled (`ufw` is common), allow the port:

```bash
sudo ufw allow 8000/tcp          # the HTTP API
sudo ufw allow 5020/tcp          # only if you also use --modbus-port 5020
sudo ufw status                  # confirm the rules are listed
```

If `ufw status` says `inactive`, there's no firewall blocking you and you can
skip this. (Fresh Raspberry Pi OS has no firewall by default.)

## 5. From the other computer: check you can reach it

Before involving the app, prove the network path works. On your PC:

```bash
ping 192.168.1.50                                  # replace with your PI_IP

curl http://192.168.1.50:8000/api/info             # should return JSON
# -> {"ok": true, "running": ..., "programRev": ..., ...}
```

If `curl` returns that JSON, **you're connected** — the rest is just pointing the
app at this address. If it hangs or refuses, jump to
[Troubleshooting](#9-troubleshooting).

## 6. Load a PLC program onto the Pi

The gateway reads whatever program the runtime is running, so first put one
there. The TIA Web app is served *by the runtime*, so:

1. On your PC (or the Pi), open a browser to **`http://192.168.1.50:8000`** —
   this loads the TIA Web app straight from the Pi.
2. Author your ladder/FBD program (or use the demo that loads automatically).
3. In the **Online (PLC)** toolbar group: **Connect → Download → PLC →
   Monitor**. Because the app was served by the runtime, Connect/Download talk
   to that same Pi (same-origin) and load your program onto it.

You now have a program running on the Pi. Any time you change it, just
**Download → PLC** again — the gateway picks up tag changes automatically
(see the [main connect guide](connecting-tia-web-practice.md)).

## 7. Connect the gateway to the Pi

On your PC, start the gateway + scene from the `automation_sim` directory:

```bash
npm install        # first time only
npm run dev        # gateway :8082 + 3D scene :5173
```

Open the scene at **`http://localhost:5173`**, then either:

- **Online ▾ menu (no config editing):** click **Online ▾**, enter a connection
  name (e.g. `pi-plc`) and the Pi's address `192.168.1.50:8000`, click **Test**
  (confirms it's a real runtime), then **Connect**. Done — the Pi's tags stream
  in live, and you can add more PLCs the same way.
- **config.json (a fixed default):** edit
  `automation_sim/gateway/config.json`'s `tiaweb` entry to
  `"url": "http://192.168.1.50:8000"` and restart the gateway.

Either way, the Pi's PLC tags now flow into the 3D scene and panels, and panel
widgets can force its inputs — over the network, in real time.

Prefer Modbus? Point the gateway's generic `modbus` adapter at
`192.168.1.50:5020` instead (you started the runtime with `--modbus-port 5020`
in step 2). See the [main connect guide](connecting-tia-web-practice.md) →
"reach the runtime over the wire".

## 8. Keep the runtime running on boot (optional)

So the Pi is a PLC the moment it powers on — no SSH, no manual start — install
`plc_server.py` as a **systemd service**. On the Pi, create
`/etc/systemd/system/tia-plc.service` (adjust the path and user):

```ini
[Unit]
Description=TIA Web Practice PLC runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/TIA_Portal_Web-app
ExecStart=/usr/bin/python3 plc_server.py
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tia-plc.service
sudo systemctl status tia-plc.service      # confirm it's active (running)
journalctl -u tia-plc.service -f           # follow its logs
```

Now the runtime starts on every boot. Add `--modbus-port 5020` to the
`ExecStart` line if you want Modbus too. (Leave off `--mock` on a real Pi so it
drives GPIO.)

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `ping` works but `curl http://PI_IP:8000/api/info` hangs/refuses | The runtime isn't running, or a firewall is blocking the port. Confirm `plc_server.py` is up on the Pi, then open the port ([§4](#4-open-the-port-in-the-pis-firewall)). |
| `ping` itself fails | The two machines aren't on the same network/subnet (e.g. one's on Wi-Fi guest network, one on Ethernet), or you have the wrong `PI_IP`. Re-check `hostname -I` on the Pi. |
| Works from the Pi's own browser (`localhost:8000`) but not from the PC | You're using `localhost`/`127.0.0.1` on the PC — that means "this PC", not the Pi. Use the Pi's actual IP. |
| `raspberrypi.local` doesn't resolve | mDNS isn't working on your network — use the numeric IP instead, or set a DHCP reservation ([§3](#3-find-the-pis-address)). |
| Online menu **Test** says unreachable, but curl works | Make sure you typed just `192.168.1.50:8000` (the menu adds `http://`); check nothing else is between the machines (VPN, client isolation on the Wi-Fi AP). |
| Tags never appear even though online | You haven't done **Download → PLC** in the TIA app yet — the runtime has no program ([§6](#6-load-a-plc-program-onto-the-pi)). |
| The Pi's IP changes after a reboot | Reserve it in your router's DHCP (by MAC), or use the `.local` hostname ([§3](#3-find-the-pis-address)). |
| Modbus client can't connect on 5020 | You didn't start the runtime with `--modbus-port 5020`, or that port isn't open in the firewall ([§4](#4-open-the-port-in-the-pis-firewall)). |

## 10. Security note

The runtime speaks **plain HTTP with no authentication**, and anyone who can
reach `PI_IP:8000` can read state and force I/O. That's exactly what you want on
a **trusted home/lab LAN**, but **do not port-forward it to the internet** or put
it on an untrusted network. If you need remote access, tunnel it (SSH, WireGuard,
Tailscale) rather than exposing the port directly.

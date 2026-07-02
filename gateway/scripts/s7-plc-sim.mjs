// Fake hydraulic press speaking real S7comm (snap7 server) for local testing.
//   node scripts/s7-plc-sim.mjs [port]
//
// Listens on ISO-on-TCP port 9102 (real PLCs use 102), rack 0 / slot 1.
// DB1 map (big-endian, as S7 hardware):
//   REAL 0   ramPosition   mm, cycles 0 -> 300 -> 0 over ~4 s while running
//   REAL 4   pressure      bar, spikes toward targetPressure at bottom of stroke
//   X   8.0  cycleActive   mirrors run command
//   INT  10  cycleCount    +1 per completed stroke
//   X  12.0  runCmd        writable by clients
//   REAL 14  targetPressure writable by clients (default 150 bar)
//
// Note: the dynamics tick does GetArea -> modify -> SetArea; a client write
// landing inside that sub-ms window can be overwritten. Fine for a sim.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const snap7 = require('node-snap7');

const PORT = Number(process.argv[2] ?? 9102);
const DB = 1;

const server = new snap7.S7Server();
const initial = Buffer.alloc(64);
initial.writeFloatBE(150, 14); // default target pressure
server.RegisterArea(server.srvAreaDB, DB, initial);
server.SetParam(server.LocalPort, PORT);
server.StartTo('0.0.0.0');
console.log(`[s7-sim] hydraulic press listening on iso-tcp://0.0.0.0:${PORT} (rack 0, slot 1, DB${DB})`);

let phase = 0;
let cycleCount = 0;
let pressure = 5;
let lastRunCmd = null;

setInterval(() => {
  const buf = server.GetArea(server.srvAreaDB, DB);

  const runCmd = (buf.readUInt8(12) & 0x01) !== 0;
  let target = buf.readFloatBE(14);
  if (!Number.isFinite(target) || target < 0) target = 150;
  target = Math.min(400, target);

  if (runCmd !== lastRunCmd) {
    console.log(`[s7-sim] run command -> ${runCmd ? 'ON' : 'OFF'}`);
    lastRunCmd = runCmd;
  }

  if (runCmd) {
    phase += 0.1 / 4; // 4 s per stroke
    if (phase >= 1) {
      phase -= 1;
      cycleCount = (cycleCount + 1) & 0x7fff;
    }
  }
  const ram = 150 * (1 - Math.cos(phase * 2 * Math.PI)); // 0..300 mm
  const pressing = runCmd && ram > 240;
  pressure += ((pressing ? target : 5) - pressure) * 0.15 + (Math.random() - 0.5) * 0.8;
  pressure = Math.max(0, pressure);

  buf.writeFloatBE(ram, 0);
  buf.writeFloatBE(pressure, 4);
  buf.writeUInt8(runCmd ? 1 : 0, 8);
  buf.writeInt16BE(cycleCount, 10);
  server.SetArea(server.srvAreaDB, DB, buf);
}, 100);

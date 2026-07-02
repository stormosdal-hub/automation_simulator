// Fake conveyor PLC speaking real Modbus TCP (port 5020) for local testing.
//   node scripts/modbus-plc-sim.mjs [port]
//
// Register map (unit 1):
//   coil 0              motor run command (writable)
//   discrete input 0    motor running feedback (follows coil after 400 ms)
//   holding register 0  speed setpoint, raw 0-1000 = 0-100.0 % (writable)
//   input register 0    belt speed, raw 0-1000 = 0-100.0 % (first-order lag)
//   input register 1    motor current, raw = A * 100 (rises with belt speed)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const ModbusRTU = require('modbus-serial');

const PORT = Number(process.argv[2] ?? 5020);

let runCmd = false;
let cmdChangedAt = 0;
let speedSetpoint = 500; // raw, = 50.0 %
let beltSpeed = 0; // raw
let running = false;

setInterval(() => {
  running = runCmd && Date.now() - cmdChangedAt > 400;
  const target = running ? speedSetpoint : 0;
  beltSpeed += (target - beltSpeed) * 0.08;
  if (Math.abs(target - beltSpeed) < 1) beltSpeed = target;
}, 50);

const motorCurrent = () => {
  const amps = (beltSpeed / 1000) * 6 + (running ? 0.4 : 0);
  // never negative: registers are unsigned 16-bit
  return Math.max(0, Math.round(amps * 100 + (Math.random() - 0.5) * 8));
};

const vector = {
  getCoil: (addr) => (addr === 0 ? runCmd : false),
  getDiscreteInput: (addr) => (addr === 0 ? running : false),
  getHoldingRegister: (addr) => (addr === 0 ? speedSetpoint : 0),
  getInputRegister: (addr) => (addr === 0 ? Math.round(beltSpeed) : addr === 1 ? motorCurrent() : 0),
  setCoil: (addr, value) => {
    if (addr === 0) {
      runCmd = value;
      cmdChangedAt = Date.now();
      console.log(`[plc-sim] motor run command -> ${value}`);
    }
  },
  setRegister: (addr, value) => {
    if (addr === 0) {
      speedSetpoint = Math.min(1000, Math.max(0, value));
      console.log(`[plc-sim] speed setpoint -> ${speedSetpoint / 10} %`);
    }
  },
};

const server = new ModbusRTU.ServerTCP(vector, { host: '0.0.0.0', port: PORT, unitID: 1 });
server.on('socketError', (err) => console.warn(`[plc-sim] socket error: ${err.message}`));
console.log(`[plc-sim] conveyor PLC listening on modbus-tcp://0.0.0.0:${PORT} (unit 1)`);

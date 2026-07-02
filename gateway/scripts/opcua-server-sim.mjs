// Fake mixer skid speaking real OPC UA for local testing.
//   node scripts/opcua-server-sim.mjs [port]
//
// Endpoint: opc.tcp://0.0.0.0:4850/UA/MixerSim   (ns=1 string node ids)
//   ns=1;s=Mixer.AgitatorOn     Boolean  writable   agitator run command
//   ns=1;s=Mixer.AgitatorSpeed  Double   writable   setpoint, RPM (0-1500)
//   ns=1;s=Mixer.TankLevel      Double   read-only  %, oscillates while mixing
//   ns=1;s=Mixer.MotorTemp      Double   read-only  degC, lags toward speed-dependent target
//   ns=1;s=Mixer.BatchCount     UInt32   read-only  +1 every 8 s while mixing
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const { OPCUAServer, Variant, DataType, StatusCodes, MessageSecurityMode, SecurityPolicy } =
  require('node-opcua');

const PORT = Number(process.argv[2] ?? 4850);

// ---- process state ----
let agitatorOn = false;
let agitatorSpeed = 600; // RPM
let tankLevel = 42; // %
let motorTemp = 22; // degC
let batchCount = 0;
let mixPhase = 0;
let batchElapsed = 0;

setInterval(() => {
  const dt = 0.1;
  if (agitatorOn) {
    mixPhase += dt * (agitatorSpeed / 600);
    tankLevel = 42 + Math.sin(mixPhase * 0.7) * 18;
    batchElapsed += dt;
    if (batchElapsed >= 8) {
      batchElapsed = 0;
      batchCount++;
      console.log(`[opcua-sim] batch complete -> ${batchCount}`);
    }
  }
  const targetTemp = agitatorOn ? 25 + (agitatorSpeed / 1500) * 40 : 22;
  motorTemp += (targetTemp - motorTemp) * 0.02;
}, 100);

// ---- server ----
const server = new OPCUAServer({
  port: PORT,
  resourcePath: '/UA/MixerSim',
  buildInfo: { productName: 'MixerSim', productUri: 'urn:automation-sim:mixer' },
  securityModes: [MessageSecurityMode.None],
  securityPolicies: [SecurityPolicy.None],
});

await server.initialize();
const addressSpace = server.engine.addressSpace;
const ns = addressSpace.getOwnNamespace();
const mixer = ns.addObject({
  organizedBy: addressSpace.rootFolder.objects,
  browseName: 'Mixer',
});

const addVar = (name, dataType, opts) =>
  ns.addVariable({
    componentOf: mixer,
    browseName: name,
    nodeId: `s=Mixer.${name}`,
    dataType,
    minimumSamplingInterval: 50,
    ...opts,
  });

addVar('AgitatorOn', 'Boolean', {
  accessLevel: 'CurrentRead | CurrentWrite',
  userAccessLevel: 'CurrentRead | CurrentWrite',
  value: {
    get: () => new Variant({ dataType: DataType.Boolean, value: agitatorOn }),
    set: (variant) => {
      agitatorOn = variant.value === true;
      console.log(`[opcua-sim] agitator -> ${agitatorOn ? 'ON' : 'OFF'}`);
      return StatusCodes.Good;
    },
  },
});

addVar('AgitatorSpeed', 'Double', {
  accessLevel: 'CurrentRead | CurrentWrite',
  userAccessLevel: 'CurrentRead | CurrentWrite',
  value: {
    get: () => new Variant({ dataType: DataType.Double, value: agitatorSpeed }),
    set: (variant) => {
      agitatorSpeed = Math.min(1500, Math.max(0, Number(variant.value)));
      console.log(`[opcua-sim] agitator speed -> ${agitatorSpeed} RPM`);
      return StatusCodes.Good;
    },
  },
});

addVar('TankLevel', 'Double', {
  value: { get: () => new Variant({ dataType: DataType.Double, value: Math.round(tankLevel * 10) / 10 }) },
});

addVar('MotorTemp', 'Double', {
  value: { get: () => new Variant({ dataType: DataType.Double, value: Math.round(motorTemp * 10) / 10 }) },
});

addVar('BatchCount', 'UInt32', {
  value: { get: () => new Variant({ dataType: DataType.UInt32, value: batchCount }) },
});

await server.start();
console.log(`[opcua-sim] mixer skid listening on opc.tcp://0.0.0.0:${PORT}/UA/MixerSim`);

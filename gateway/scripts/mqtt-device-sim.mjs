// Fake ESP32 "fan node" speaking MQTT against the local broker (mosquitto).
//   node scripts/mqtt-device-sim.mjs [mqtt://host:port]
//
// Topics (namespaced under automation-sim/):
//   automation-sim/env/temperature   pub 1 s, JSON {"value": 23.4, "unit": "degC"}
//   automation-sim/env/humidity      pub 1 s, JSON {"value": 47.9, "unit": "%"}
//   automation-sim/fan/state/on      retained, raw JSON bool — confirmed state
//   automation-sim/fan/state/speed   retained, raw JSON number — confirmed setpoint %
//   automation-sim/fan/state/rpm     pub 500 ms, raw JSON number (lags toward speed*30)
//   automation-sim/fan/cmd/on        sub — bool command
//   automation-sim/fan/cmd/speed     sub — number command (0-100)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'));
const mqtt = require('mqtt');

const URL = process.argv[2] ?? 'mqtt://127.0.0.1:1883';
const NS = 'automation-sim';

let fanOn = false;
let fanSpeed = 50; // %
let rpm = 0;
let temperature = 23.5;
let humidity = 48;

// LWT: if this process dies without a clean DISCONNECT, the broker publishes
// retained "offline" on the status topic — device liveness for subscribers.
const client = mqtt.connect(URL, {
  reconnectPeriod: 2000,
  will: { topic: `${NS}/fan/status`, payload: Buffer.from('offline'), qos: 1, retain: true },
});

const pub = (topic, value, retain = false) =>
  client.publish(`${NS}/${topic}`, JSON.stringify(value), { qos: 0, retain });

client.on('connect', () => {
  console.log(`[mqtt-sim] fan node connected to ${URL}`);
  client.subscribe([`${NS}/fan/cmd/on`, `${NS}/fan/cmd/speed`], { qos: 1 });
  client.publish(`${NS}/fan/status`, 'online', { qos: 1, retain: true });
  pub('fan/state/on', fanOn, true);
  pub('fan/state/speed', fanSpeed, true);
});

client.on('message', (topic, payload) => {
  const text = payload.toString();
  if (topic === `${NS}/fan/cmd/on`) {
    fanOn = text === 'true' || text === '1' || text === 'on';
    console.log(`[mqtt-sim] fan -> ${fanOn ? 'ON' : 'OFF'}`);
    pub('fan/state/on', fanOn, true);
  }
  if (topic === `${NS}/fan/cmd/speed`) {
    const v = Number(JSON.parse(text));
    if (Number.isFinite(v)) {
      fanSpeed = Math.min(100, Math.max(0, v));
      console.log(`[mqtt-sim] fan speed -> ${fanSpeed} %`);
      pub('fan/state/speed', fanSpeed, true);
    }
  }
});

// fan physics: rpm lags toward setpoint; the fan cools the room a little
setInterval(() => {
  rpm += ((fanOn ? fanSpeed * 30 : 0) - rpm) * 0.1;
  if (rpm < 1) rpm = 0;
}, 200);

setInterval(() => pub('fan/state/rpm', Math.round(rpm)), 500);

setInterval(() => {
  const cooling = (rpm / 3000) * 0.08;
  temperature += 0.02 - cooling + (Math.random() - 0.5) * 0.04;
  temperature = Math.min(35, Math.max(15, temperature));
  humidity += (Math.random() - 0.5) * 0.4;
  humidity = Math.min(70, Math.max(30, humidity));
  pub('env/temperature', { value: Math.round(temperature * 10) / 10, unit: 'degC' });
  pub('env/humidity', { value: Math.round(humidity * 10) / 10, unit: '%' });
}, 1000);

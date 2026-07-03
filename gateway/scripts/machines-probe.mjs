#!/usr/bin/env node
// Smoke test for the press + mixer MACHINE MODELS (bus adapters, no external
// devices): drives their command tags through the gateway WS and asserts the
// plant dynamics — press stroke/pressure/limit switches/cycle counting, mixer
// slosh/batch pulses/thermal lag/over-temp alarm.
//
// Needs: gateway on :8092 (GATEWAY_PORT=8092 npm run start -w @sim/gateway).
// The TIA runtime is NOT required. Run: node scripts/machines-probe.mjs
import WebSocket from 'ws';

const GATEWAY = 'ws://127.0.0.1:8092';

const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`);

const latest = new Map();
let sawBottom = false;
let sawPressing = false;
let sawBatchPulse = false;
let maxPressure = 0;
const ws = new WebSocket(GATEWAY);
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  const updates = msg.type === 'hello' ? msg.snapshot : msg.type === 'tagUpdate' ? msg.updates : [];
  for (const u of updates) {
    latest.set(u.tagId, u.value);
    if (u.tagId === 'press.atBottom' && u.value === true) sawBottom = true;
    if (u.tagId === 'press.pressing' && u.value === true) sawPressing = true;
    if (u.tagId === 'mixer.batchDone' && u.value === true) sawBatchPulse = true;
    if (u.tagId === 'press.pressure' && typeof u.value === 'number') maxPressure = Math.max(maxPressure, u.value);
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(name, pred, timeoutMs = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (pred()) { ok(name, true); return true; }
    await sleep(50);
  }
  const snap = Object.fromEntries([...latest].filter(([k]) => k.startsWith('press.') || k.startsWith('mixer.')));
  ok(name, false, `timeout — ${JSON.stringify(snap)}`);
  return false;
}
const write = (tagId, value) => ws.send(JSON.stringify({ type: 'write', tagId, value }));

async function main() {
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await sleep(300);

  // ---------------- press ----------------
  ok('press idle: ram at top, no cycles, low pressure',
    latest.get('press.atTop') === true && (latest.get('press.cycleCount') ?? 9) === 0
    && (latest.get('press.pressure') ?? 99) < 20 && latest.get('press.cycleActive') === false,
    JSON.stringify(Object.fromEntries([...latest].filter(([k]) => k.startsWith('press.')))));

  write('press.targetPressure', 200);
  write('press.runCmd', true);
  await waitFor('press cycleActive on run', () => latest.get('press.cycleActive') === true);
  await waitFor('ram strokes downward', () => (latest.get('press.ramPosition') ?? 0) > 100, 3000);
  await waitFor('bottom limit switch fires', () => sawBottom, 4000);
  await waitFor('pressing zone flag fires', () => sawPressing, 4000);
  await waitFor('pressure builds toward the 200 bar setpoint', () => maxPressure >= 120, 6000);
  await waitFor('cycle counted after a full stroke', () => (latest.get('press.cycleCount') ?? 0) >= 1, 7000);
  await waitFor('second cycle counted', () => (latest.get('press.cycleCount') ?? 0) >= 2, 11000);

  write('press.runCmd', false);
  await waitFor('press stops on runCmd off', () => latest.get('press.cycleActive') === false);
  await waitFor('pressure decays when idle', () => (latest.get('press.pressure') ?? 999) < 30, 6000);

  // ---------------- mixer ----------------
  ok('mixer idle: ambient temp, no batches, no alarm',
    latest.get('mixer.agitatorOn') === false && (latest.get('mixer.batchCount') ?? 9) === 0
    && Math.abs((latest.get('mixer.motorTemp') ?? 0) - 22) < 2 && latest.get('mixer.overTemp') === false,
    JSON.stringify(Object.fromEntries([...latest].filter(([k]) => k.startsWith('mixer.')))));

  write('mixer.agitatorSpeed', 1200);
  write('mixer.agitatorOn', true);
  await waitFor('tank level sloshes while mixing',
    () => Math.abs((latest.get('mixer.tankLevel') ?? 42) - 42) > 5, 5000);
  await waitFor('batch progress advances', () => (latest.get('mixer.batchProgress') ?? 0) > 20, 4000);
  await waitFor('batchDone pulses and batch counted',
    () => sawBatchPulse && (latest.get('mixer.batchCount') ?? 0) >= 1, 12000);
  await waitFor('motor heats up under load', () => (latest.get('mixer.motorTemp') ?? 0) > 35, 12000);
  await waitFor('overTemp alarm above 50 degC', () => latest.get('mixer.overTemp') === true, 20000);

  write('mixer.agitatorOn', false);
  await sleep(500);
  const lvl1 = latest.get('mixer.tankLevel');
  const tmp1 = latest.get('mixer.motorTemp');
  await sleep(2500);
  ok('level freezes when agitator stops', latest.get('mixer.tankLevel') === lvl1,
    `${lvl1} -> ${latest.get('mixer.tankLevel')}`);
  ok('motor cools toward ambient', (latest.get('mixer.motorTemp') ?? 99) < tmp1,
    `${tmp1} -> ${latest.get('mixer.motorTemp')}`);
}

main()
  .catch((e) => ok('script ran', false, e && (e.stack || e.message)))
  .finally(() => {
    ws.close();
    console.log(results.join('\n'));
    console.log(`== ${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed ==`);
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  });

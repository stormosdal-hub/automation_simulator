#!/usr/bin/env node
// Closed-loop smoke test: TIA PLC ⇄ conveyor machine model via tag links.
//
//   tia.Motor        → conv.motorCmd     (ladder output runs the belt)
//   tia.Conveyor_PWM → conv.speedCmd     (NORM_X duty scales belt speed)
//   conv.photoEye    → tia.Part_Sensor   (the WORLD feeds the PLC input)
//
// The only human action is pressing Start (and later Stop). Everything else —
// parts spawning, reaching the photo-eye, the CTU counting, the belt speeding
// up as the count rises — must happen on its own through the links.
//
// Needs: plc_server.py --mock on :8000, gateway on :8092 (GATEWAY_PORT=8092).
// Run: node scripts/conveyor-loop-probe.mjs
import WebSocket from 'ws';

const GATEWAY = 'ws://127.0.0.1:8092';
const TIA = 'http://127.0.0.1:8000';

const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`);

// ---- same conveyor program the tiaweb probe uses ----
const el = (id, kind, operand = '', params = null) => {
  const e = { id, kind, operand };
  if (params) e.params = params;
  return e;
};
const stage = (id, branches) => ({ id, branches: branches.map((els, i) => ({ id: `${id}b${i}`, elements: els })) });
const net = (id, stages, outputs) => ({ id, title: id, stages, outputs, boxes: [], wires: [] });
const project = {
  name: 'GatewayDemo', scanMs: 50, gpio: [],
  tags: [
    { id: 't1', name: 'Start_PB', dataType: 'Bool', address: 'I0.0' },
    { id: 't2', name: 'Stop_PB', dataType: 'Bool', address: 'I0.1' },
    { id: 't3', name: 'Part_Sensor', dataType: 'Bool', address: 'I0.2' },
    { id: 't4', name: 'Motor', dataType: 'Bool', address: 'Q0.0' },
    { id: 't5', name: 'Run_Lamp', dataType: 'Bool', address: 'Q0.1' },
    { id: 't6', name: 'Count_Done', dataType: 'Bool', address: 'M0.0' },
    { id: 't7', name: 'Part_Count', dataType: 'Int', address: 'MW10' },
    { id: 't8', name: 'Conveyor_PWM', dataType: 'Real', address: 'MD20' },
  ],
  blocks: [{
    id: 'ob1', type: 'OB', name: 'Main', number: 1, lang: 'LAD', iface: {},
    networks: [
      net('n1',
        [stage('s1', [[el('e1', 'contact_no', 'Start_PB')], [el('e2', 'contact_no', 'Motor')]]),
         stage('s2', [[el('e3', 'contact_nc', 'Stop_PB')]])],
        [el('e4', 'coil', 'Motor')]),
      net('n2', [stage('s3', [[el('e5', 'contact_no', 'Motor')]])],
        [el('e6', 'ton', '', { pt: 'T#300ms', q: 'Run_Lamp', et: '' })]),
      net('n3', [stage('s4', [[el('e7', 'contact_no', 'Part_Sensor')]])],
        [el('e8', 'ctu', '', { pv: '5', r: '', cv: 'Part_Count', q: 'Count_Done' })]),
      net('n4', [], [el('e9', 'norm_x', '', { min: '0', val: 'Part_Count', max: '5', out: 'Conveyor_PWM', eno: '' })]),
    ],
  }],
  activeBlockId: 'ob1',
};

const latest = new Map();
let sawEye = false;
let sawSensor = false;
const ws = new WebSocket(GATEWAY);
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  const updates = msg.type === 'hello' ? msg.snapshot : msg.type === 'tagUpdate' ? msg.updates : [];
  for (const u of updates) {
    latest.set(u.tagId, u.value);
    if (u.tagId === 'conv.photoEye' && u.value === true) sawEye = true;
    if (u.tagId === 'tia.Part_Sensor' && u.value === true) sawSensor = true;
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(name, pred, timeoutMs = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (pred()) { ok(name, true); return true; }
    await sleep(50);
  }
  const tiaConv = Object.fromEntries([...latest].filter(([k]) => k.startsWith('tia.') || k.startsWith('conv.')));
  ok(name, false, `timeout — ${JSON.stringify(tiaConv)}`);
  return false;
}
const write = (tagId, value) => ws.send(JSON.stringify({ type: 'write', tagId, value }));

async function main() {
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  const res = await fetch(`${TIA}/api/program`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project),
  });
  ok('program downloaded to TIA runtime', res.ok, `HTTP ${res.status}`);

  await waitFor('tia.online', () => latest.get('tia.online') === true);
  await waitFor('conveyor idle before start', () => latest.get('conv.running') === false, 3000);

  // the ONE human action: press Start through the gateway
  write('tia.Start_PB', true);
  await waitFor('PLC latches Motor', () => latest.get('tia.Motor') === true);
  write('tia.Start_PB', false);

  await waitFor('link tia.Motor → conv.motorCmd starts the belt', () => latest.get('conv.running') === true);
  await waitFor('belt moves at the min-speed floor (PWM still 0)',
    () => (latest.get('conv.beltSpeed') ?? 0) >= 0.39 && (latest.get('conv.beltSpeed') ?? 9) <= 0.45);

  // now the world runs itself: feeder → belt → photo-eye → PLC input → CTU
  await waitFor('photo-eye pulses as a part passes', () => sawEye, 15000);
  await waitFor('link conv.photoEye → tia.Part_Sensor reached the PLC', () => sawSensor, 3000);
  await waitFor('CTU counted 2 parts (closed loop, no client writes)',
    () => (latest.get('tia.Part_Count') ?? 0) >= 2, 30000);
  await waitFor('belt sped up from the PLC\'s NORM_X duty (PWM feedback)',
    () => (latest.get('conv.beltSpeed') ?? 0) > 0.6, 5000);
  await waitFor('parts delivered off the end', () => (latest.get('conv.partsDone') ?? 0) >= 1, 10000);

  // stop: ladder NC contact drops the seal-in, link stops the belt
  write('tia.Stop_PB', true);
  await waitFor('Stop drops the PLC Motor', () => latest.get('tia.Motor') === false);
  await waitFor('link stops the conveyor', () => latest.get('conv.running') === false
    && (latest.get('conv.beltSpeed') ?? 1) === 0);
}

main()
  .catch((e) => ok('script ran', false, e && (e.stack || e.message)))
  .finally(() => {
    ws.close();
    console.log(results.join('\n'));
    console.log(`== ${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed ==`);
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  });

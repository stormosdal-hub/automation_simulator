#!/usr/bin/env node
// (shipped as the tiaweb smoke test — see gateway/package.json "tia-probe")
// E2E test for the tiaweb gateway adapter.
//   node test-tiaweb.mjs          — downloads a conveyor program to the TIA
//                                   runtime, then drives it THROUGH the gateway
//   node test-tiaweb.mjs offline  — asserts tia.online=false (run after killing
//                                   plc_server)
import WebSocket from 'ws';

const GATEWAY = 'ws://127.0.0.1:8092';
const TIA = 'http://127.0.0.1:8000';
const MODE = process.argv[2] === 'offline' ? 'offline' : 'live';

const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : ' :: ' + extra}`);

// ---- minimal conveyor program matching gateway/config.json's tia tags ----
const el = (id, kind, operand = '', params = null, args = null) => {
  const e = { id, kind, operand };
  if (params) e.params = params;
  if (args) e.args = args;
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

// ---- tiny WS client that tracks latest values ----
const latest = new Map();
let hello = null;
const ws = new WebSocket(GATEWAY);
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'hello') {
    hello = msg;
    for (const u of msg.snapshot) latest.set(u.tagId, u.value);
  } else if (msg.type === 'tagUpdate') {
    for (const u of msg.updates) latest.set(u.tagId, u.value);
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(name, pred, timeoutMs = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (pred()) { ok(name, true); return true; }
    await sleep(50);
  }
  ok(name, false, `timeout — tia.* latest: ${JSON.stringify(Object.fromEntries([...latest].filter(([k]) => k.startsWith('tia.'))))}`);
  return false;
}
const write = (tagId, value) => ws.send(JSON.stringify({ type: 'write', tagId, value }));

async function main() {
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  if (MODE === 'offline') {
    await waitFor('tia.online is FALSE after runtime death', () => latest.get('tia.online') === false, 6000);
    await waitFor('tia.running fails safe to FALSE', () => latest.get('tia.running') === false, 1000);
    return;
  }

  // download the program to the TIA runtime (as the TIA app's toolbar would)
  const res = await fetch(`${TIA}/api/program`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project),
  });
  const body = await res.json();
  ok('program downloaded to TIA runtime', res.ok && body.ok === true, JSON.stringify(body));

  await sleep(300);
  ok('hello declares the tia adapter', !!hello && hello.adapters.some((a) => a.id === 'tia'),
    hello && JSON.stringify(hello.adapters.map((a) => a.id)));
  ok('hello declares tia tags incl. writability',
    !!hello && hello.tags.some((t) => t.id === 'tia.Start_PB' && t.writable === true)
            && hello.tags.some((t) => t.id === 'tia.Motor' && !t.writable));

  await waitFor('tia.online goes TRUE', () => latest.get('tia.online') === true);
  await waitFor('tia.running reflects PLC RUN', () => latest.get('tia.running') === true);

  // seal-in: press Start through the gateway -> Motor latches in the PLC
  write('tia.Start_PB', true);
  await waitFor('Start_PB write reaches the PLC and Motor latches', () => latest.get('tia.Motor') === true);
  write('tia.Start_PB', false);
  await waitFor('Motor stays latched after Start released', async () => latest.get('tia.Motor') === true);
  await waitFor('Run_Lamp on after TON 300ms', () => latest.get('tia.Run_Lamp') === true);

  // count two parts
  for (let i = 0; i < 2; i++) {
    write('tia.Part_Sensor', true); await sleep(300);
    write('tia.Part_Sensor', false); await sleep(300);
  }
  await waitFor('CTU counted 2 parts', () => latest.get('tia.Part_Count') === 2);
  await waitFor('NORM_X duty follows count (0.4)', () => Math.abs((latest.get('tia.Conveyor_PWM') ?? 0) - 0.4) < 1e-6);

  // stop: NC contact drops the seal-in
  write('tia.Stop_PB', true);
  await waitFor('Stop_PB drops the motor', () => latest.get('tia.Motor') === false);
  await waitFor('Run_Lamp off after motor stop', () => latest.get('tia.Run_Lamp') === false);

  // write rejection: read-only tag
  const err = await new Promise((resolve) => {
    const h = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === 'writeError' && m.tagId === 'tia.Motor') { ws.off('message', h); resolve(m); }
    };
    ws.on('message', h);
    write('tia.Motor', true);
    setTimeout(() => resolve(null), 2000);
  });
  ok('write to read-only tia.Motor is rejected with writeError', !!err, 'no writeError received');
}

main()
  .catch((e) => ok('script ran', false, e && (e.stack || e.message)))
  .finally(() => {
    ws.close();
    console.log(results.join('\n'));
    console.log(`== ${results.filter((r) => r.startsWith('PASS')).length} passed, ${results.filter((r) => r.startsWith('FAIL')).length} failed ==`);
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  });

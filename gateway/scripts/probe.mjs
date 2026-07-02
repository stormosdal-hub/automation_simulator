// Quick gateway smoke test: connects, expects a hello (adapters, tags,
// snapshot) + a few tagUpdates.
//   node scripts/probe.mjs [ws://host:port]
import WebSocket from 'ws';

const url = process.argv[2] ?? 'ws://localhost:8082';
const ws = new WebSocket(url);
const timer = setTimeout(() => {
  console.error(`probe: TIMEOUT — no data from ${url} within 5s`);
  process.exit(1);
}, 5000);

let hello = null;
let updateCount = 0;

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'hello') hello = msg;
  if (msg.type === 'tagUpdate' && ++updateCount >= 5) {
    console.log('probe: adapters =', JSON.stringify(hello?.adapters));
    console.log('probe: tags =', JSON.stringify(hello?.tags.map((t) => t.id)));
    console.log('probe: snapshot size =', hello?.snapshot.length);
    console.log('probe: sample update =', JSON.stringify(msg.updates, null, 2));
    clearTimeout(timer);
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('probe:', err.message);
  process.exit(1);
});

import dgram from 'node:dgram';
import os from 'node:os';
import type { ScanHit } from '@sim/shared';

const PROBE_TIMEOUT_MS = 700;
const CONCURRENCY = 96;
const MAX_SUBNETS = 2; // bound the work: scan the primary LAN /24 (+ at most one more)

export interface ScanReport {
  found: ScanHit[];
  scanned: number;
  subnets: string[];
}

/** The gateway's primary outbound LAN IPv4 (UDP-connect trick — sends nothing). */
function primaryIp(): Promise<string | null> {
  return new Promise((resolve) => {
    const s = dgram.createSocket('udp4');
    let done = false;
    const finish = (v: string | null): void => {
      if (done) return;
      done = true;
      try {
        s.close();
      } catch {
        /* already closed */
      }
      resolve(v);
    };
    s.on('error', () => finish(null));
    try {
      s.connect(80, '8.8.8.8', () => {
        try {
          finish(s.address().address);
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), 500);
  });
}

/** The /24 base(s) to sweep — the primary interface first, then any other non-internal IPv4, capped. */
function subnetsToScan(preferred: string | null): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const add = (ip: string): void => {
    const m = /^(\d+\.\d+\.\d+)\.\d+$/.exec(ip);
    if (m && m[1] && !seen.has(m[1])) {
      seen.add(m[1]);
      order.push(m[1]);
    }
  };
  if (preferred) add(preferred);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) add(ni.address);
    }
  }
  return order.slice(0, MAX_SUBNETS);
}

/** GET /api/info on one host; returns a hit only if it looks like a TIA runtime. */
async function probe(ip: string, port: number): Promise<ScanHit | null> {
  try {
    const res = await fetch(`http://${ip}:${port}/api/info`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    if (!res.ok) return null;
    const b = (await res.json()) as { ok?: boolean; scan?: unknown; hasProgram?: unknown; project?: string | null; running?: boolean };
    if (b?.ok !== true || typeof b.scan !== 'number' || typeof b.hasProgram !== 'boolean') return null;
    return { ip, port, url: `http://${ip}:${port}`, project: b.project ?? null, running: b.running === true };
  } catch {
    return null;
  }
}

/**
 * Sweep the gateway's local subnet(s) for TIA Web Practice runtimes on `port`.
 * Bounded (at most 2 × /24, short timeout, capped concurrency) and read-only —
 * a plain `GET /api/info` per host, the same probe `Test connection` uses.
 */
export async function scanForRuntimes(port: number): Promise<ScanReport> {
  const subnets = subnetsToScan(await primaryIp());
  const ips: string[] = [];
  for (const base of subnets) for (let h = 1; h <= 254; h++) ips.push(`${base}.${h}`);

  const found: ScanHit[] = [];
  let idx = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = idx++;
      if (i >= ips.length) return;
      const hit = await probe(ips[i]!, port);
      if (hit) found.push(hit);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ips.length || 1) }, worker));
  found.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));
  return { found, scanned: ips.length, subnets: subnets.map((s) => `${s}.0/24`) };
}

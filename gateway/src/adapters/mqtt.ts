import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface MqttTagConfig {
  /** Tag id becomes `<adapterId>.<name>`. */
  name: string;
  label?: string;
  /** Topic subscribed for state/telemetry values (exact match, no wildcards). */
  topic: string;
  /** Writable tags publish commands here; defaults to `topic`. */
  commandTopic?: string;
  dataType: 'number' | 'boolean';
  /** Dot path into a JSON payload, e.g. "value" or "data.temp"; absent = whole payload. */
  jsonPath?: string;
  unit?: string;
  writable?: boolean;
  /** Publish commands with the retain flag. */
  retain?: boolean;
}

export interface MqttAdapterConfig {
  id: string;
  label?: string;
  /** e.g. "mqtt://127.0.0.1:1883" */
  url: string;
  username?: string;
  password?: string;
  /**
   * Device-liveness topic (LWT pattern): the device publishes retained
   * "online" here and sets a will of "offline". Exposed as `<id>.deviceOnline`.
   */
  availabilityTopic?: string;
  tags: MqttTagConfig[];
}

const HEARTBEAT_MS = 2000;

/**
 * MQTT adapter: subscribes to state topics and maps payloads to tags (raw
 * values or a JSON path into an object payload). Writes publish to the tag's
 * command topic (qos 1) — the device is expected to confirm by publishing its
 * new state, which flows back like any other update (command/state pattern).
 * mqtt.js owns reconnection; a heartbeat republishes cached values so
 * change-driven tags don't read as stale.
 */
export class MqttAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private client: MqttClient | null = null;
  private publish: PublishFn | null = null;
  private online = false;
  private lastValues = new Map<string, number | boolean>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  private readonly url: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly availabilityTopic?: string;
  private readonly tagConfigs: MqttTagConfig[];
  private readonly byTopic = new Map<string, MqttTagConfig[]>();

  constructor(config: MqttAdapterConfig) {
    this.url = config.url;
    this.username = config.username;
    this.password = config.password;
    this.availabilityTopic = config.availabilityTopic;
    this.tagConfigs = config.tags;
    for (const t of config.tags) {
      const list = this.byTopic.get(t.topic) ?? [];
      list.push(t);
      this.byTopic.set(t.topic, list);
    }
    this.meta = { id: config.id, label: config.label ?? `MQTT ${config.url}`, type: 'mqtt' };
    this.tags = [
      {
        id: `${config.id}.online`,
        label: 'Connection online',
        dataType: 'boolean',
        adapterId: config.id,
      },
      ...(config.availabilityTopic
        ? [
            {
              id: `${config.id}.deviceOnline`,
              label: 'Device online (LWT)',
              dataType: 'boolean' as const,
              adapterId: config.id,
            },
          ]
        : []),
      ...config.tags.map(
        (t): TagMeta => ({
          id: `${config.id}.${t.name}`,
          label: t.label ?? t.name,
          dataType: t.dataType,
          unit: t.unit,
          adapterId: config.id,
          writable: t.writable === true,
        }),
      ),
    ];
  }

  start(publish: PublishFn): void {
    this.publish = publish;
    this.client = mqtt.connect(this.url, {
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      username: this.username,
      password: this.password,
    });

    this.client.on('connect', () => {
      this.setOnline(true);
      const topics = [...this.byTopic.keys()];
      if (this.availabilityTopic) topics.push(this.availabilityTopic);
      this.client?.subscribe(topics, { qos: 1 }, (err) => {
        if (err) console.warn(`[mqtt:${this.meta.id}] subscribe failed: ${err.message}`);
        else console.log(`[mqtt:${this.meta.id}] connected to ${this.url} (${topics.length} topics)`);
      });
    });
    this.client.on('close', () => this.setOnline(false));
    this.client.on('offline', () => this.setOnline(false));
    this.client.on('error', (err) => {
      // mqtt.js keeps reconnecting; just surface the reason once in the log
      console.warn(`[mqtt:${this.meta.id}] ${err.message}`);
    });
    this.client.on('message', (topic, payload) => this.handleMessage(topic, payload));

    this.heartbeat = setInterval(() => {
      if (!this.online || this.lastValues.size === 0) return;
      const now = Date.now();
      const updates: TagUpdate[] = [...this.lastValues].map(([tagId, value]) => ({ tagId, value, ts: now }));
      updates.push({ tagId: `${this.meta.id}.online`, value: true, ts: now });
      this.publish?.(updates);
    }, HEARTBEAT_MS);
  }

  stop(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.client?.end(true);
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    if (!this.online || !this.client) throw new Error(`adapter '${this.meta.id}' is offline`);
    const cfg = this.tagConfigs.find((t) => `${this.meta.id}.${t.name}` === tagId);
    if (!cfg) throw new Error(`unknown mqtt tag '${tagId}'`);

    if (cfg.dataType === 'boolean' && typeof value !== 'boolean')
      throw new Error(`'${tagId}' expects a boolean`);
    if (cfg.dataType === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new Error(`'${tagId}' expects a number`);

    const topic = cfg.commandTopic ?? cfg.topic;
    await new Promise<void>((resolve, reject) => {
      this.client?.publish(
        topic,
        JSON.stringify(value),
        { qos: 1, retain: cfg.retain === true },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }

  private setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    if (!online) {
      this.lastValues.clear();
      console.log(`[mqtt:${this.meta.id}] connection lost — mqtt.js is reconnecting`);
    }
    this.publish?.([{ tagId: `${this.meta.id}.online`, value: online, ts: Date.now() }]);
  }

  private handleMessage(topic: string, payload: Buffer): void {
    if (topic === this.availabilityTopic) {
      const online = payload.toString().trim().toLowerCase() === 'online';
      const tagId = `${this.meta.id}.deviceOnline`;
      this.lastValues.set(tagId, online);
      this.publish?.([{ tagId, value: online, ts: Date.now() }]);
      return;
    }
    const configs = this.byTopic.get(topic);
    if (!configs) return;

    const text = payload.toString();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // raw string payload
    }

    const now = Date.now();
    const updates: TagUpdate[] = [];
    for (const cfg of configs) {
      const raw = cfg.jsonPath ? walkPath(parsed, cfg.jsonPath) : parsed;
      const value = coerce(raw, cfg.dataType);
      if (value === null) continue;
      const tagId = `${this.meta.id}.${cfg.name}`;
      this.lastValues.set(tagId, value);
      updates.push({ tagId, value, ts: now });
    }
    if (updates.length > 0) this.publish?.(updates);
  }
}

function walkPath(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function coerce(raw: unknown, dataType: 'number' | 'boolean'): number | boolean | null {
  if (dataType === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 1 || raw === '1' || raw === 'true' || raw === 'on' || raw === 'ON') return true;
    if (raw === 0 || raw === '0' || raw === 'false' || raw === 'off' || raw === 'OFF') return false;
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

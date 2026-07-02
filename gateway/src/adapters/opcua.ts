import {
  AttributeIds,
  DataType,
  MessageSecurityMode,
  OPCUAClient,
  SecurityPolicy,
  TimestampsToReturn,
} from 'node-opcua';
import type { ClientSession, ClientSubscription, DataValue, NodeId } from 'node-opcua';
import type { AdapterMeta, TagMeta, TagUpdate } from '@sim/shared';
import type { Adapter, PublishFn } from '../adapter';

export interface OpcUaTagConfig {
  /** Tag id becomes `<adapterId>.<name>`. */
  name: string;
  label?: string;
  /** e.g. "ns=1;s=Mixer.TankLevel" */
  nodeId: string;
  dataType: 'number' | 'boolean';
  unit?: string;
  writable?: boolean;
}

export interface OpcUaAdapterConfig {
  id: string;
  label?: string;
  /** e.g. "opc.tcp://192.168.1.50:4840" */
  endpoint: string;
  publishingIntervalMs?: number;
  samplingIntervalMs?: number;
  tags: OpcUaTagConfig[];
}

const RETRY_MS = 3000;
/** OPC UA built-in numeric types that must be rounded before writing. */
const INTEGER_TYPES = new Set<DataType>([
  DataType.SByte,
  DataType.Byte,
  DataType.Int16,
  DataType.UInt16,
  DataType.Int32,
  DataType.UInt32,
  DataType.Int64,
  DataType.UInt64,
]);

/**
 * OPC UA client adapter: subscribes to value changes (monitored items) instead
 * of polling — the server pushes at its publishing interval. Writable tags
 * resolve the server node's actual DataType at connect so writes are coerced
 * correctly (e.g. Double vs Float vs Int32). Reconnection is owned entirely
 * by the outer retry loop (full teardown + fresh session/subscription) so
 * there is one recovery mechanism, mirrored into `<id>.online` — node-opcua's
 * internal retry is capped low to avoid fighting it.
 */
export class OpcUaAdapter implements Adapter {
  readonly meta: AdapterMeta;
  readonly tags: TagMeta[];

  private client: OPCUAClient | null = null;
  private session: ClientSession | null = null;
  private subscription: ClientSubscription | null = null;
  private writeTypes = new Map<string, DataType>();
  private publish: PublishFn | null = null;
  private online = false;
  private stopped = false;
  private reconnecting = false;
  /** Last value per tag; heartbeat republishes these so change-driven tags don't look stale. */
  private lastValues = new Map<string, number | boolean>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  private readonly endpoint: string;
  private readonly publishingIntervalMs: number;
  private readonly samplingIntervalMs: number;
  private readonly tagConfigs: OpcUaTagConfig[];

  constructor(config: OpcUaAdapterConfig) {
    this.endpoint = config.endpoint;
    this.publishingIntervalMs = config.publishingIntervalMs ?? 100;
    this.samplingIntervalMs = config.samplingIntervalMs ?? this.publishingIntervalMs;
    this.tagConfigs = config.tags;
    this.meta = {
      id: config.id,
      label: config.label ?? `OPC UA ${config.endpoint}`,
      type: 'opcua',
    };
    this.tags = [
      {
        id: `${config.id}.online`,
        label: 'Connection online',
        dataType: 'boolean',
        adapterId: config.id,
      },
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
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    void (async () => {
      try {
        await this.subscription?.terminate();
        await this.session?.close();
        await this.client?.disconnect();
      } catch {
        // shutting down anyway
      }
    })();
  }

  async write(tagId: string, value: number | boolean): Promise<void> {
    if (!this.online || !this.session) throw new Error(`adapter '${this.meta.id}' is offline`);
    const cfg = this.tagConfigs.find((t) => `${this.meta.id}.${t.name}` === tagId);
    if (!cfg) throw new Error(`unknown opcua tag '${tagId}'`);

    if (cfg.dataType === 'boolean' && typeof value !== 'boolean')
      throw new Error(`'${tagId}' expects a boolean`);
    if (cfg.dataType === 'number' && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new Error(`'${tagId}' expects a number`);

    const dataType =
      this.writeTypes.get(cfg.name) ?? (cfg.dataType === 'boolean' ? DataType.Boolean : DataType.Double);
    const coerced =
      dataType === DataType.Boolean
        ? value === true
        : INTEGER_TYPES.has(dataType)
          ? Math.round(value as number)
          : value;

    const statusCode = await this.session.write({
      nodeId: cfg.nodeId,
      attributeId: AttributeIds.Value,
      value: { value: { dataType, value: coerced } },
    });
    if (statusCode.value !== 0) {
      throw new Error(`write rejected by server: ${statusCode.toString()}`);
    }
  }

  // ---- connection lifecycle ----

  private async connect(): Promise<void> {
    if (this.stopped) return;
    try {
      this.client = OPCUAClient.create({
        applicationName: 'automation-sim-gateway',
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        endpointMustExist: false,
        connectionStrategy: { initialDelay: 500, maxDelay: 1000, maxRetry: 1 },
      });
      this.client.on('connection_lost', () => void this.handleConnectionLost());

      await this.client.connect(this.endpoint);
      this.session = await this.client.createSession();
      await this.resolveWriteTypes();
      await this.createSubscription();
      this.reconnecting = false;
      this.setOnline(true);
      // while the subscription is alive, unchanged values are still confirmed —
      // refresh them so age-based staleness in clients stays meaningful
      this.heartbeat = setInterval(() => {
        if (!this.online || this.lastValues.size === 0) return;
        const now = Date.now();
        const updates: TagUpdate[] = [...this.lastValues].map(([tagId, value]) => ({ tagId, value, ts: now }));
        updates.push({ tagId: `${this.meta.id}.online`, value: true, ts: now });
        this.publish?.(updates);
      }, 2000);
      console.log(`[opcua:${this.meta.id}] connected to ${this.endpoint} (${this.tagConfigs.length} monitored items)`);
    } catch (err) {
      this.setOnline(false);
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[opcua:${this.meta.id}] connect failed (${reason.split('\n')[0]}) — retrying in ${RETRY_MS} ms`);
      try {
        await this.client?.disconnect();
      } catch {
        // ignore teardown noise
      }
      if (!this.stopped) setTimeout(() => void this.connect(), RETRY_MS);
    }
  }

  /** Full teardown + re-enter the connect loop; guarded against double entry. */
  private async handleConnectionLost(): Promise<void> {
    if (this.stopped || this.reconnecting) return;
    this.reconnecting = true;
    this.setOnline(false);
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.lastValues.clear();
    console.log(`[opcua:${this.meta.id}] connection lost — reconnecting every ${RETRY_MS} ms`);
    try {
      await this.client?.disconnect();
    } catch {
      // stale client, discard
    }
    this.session = null;
    this.subscription = null;
    if (!this.stopped) setTimeout(() => void this.connect(), RETRY_MS);
  }

  private setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    this.publish?.([{ tagId: `${this.meta.id}.online`, value: online, ts: Date.now() }]);
  }

  /** Read the DataType attribute of each writable node so writes use the server's type. */
  private async resolveWriteTypes(): Promise<void> {
    if (!this.session) return;
    for (const t of this.tagConfigs.filter((t) => t.writable)) {
      try {
        const dv = await this.session.read({ nodeId: t.nodeId, attributeId: AttributeIds.DataType });
        const typeId = dv.value.value as NodeId | null;
        if (typeId && typeId.namespace === 0 && typeof typeId.value === 'number' && typeId.value <= 25) {
          this.writeTypes.set(t.name, typeId.value as DataType);
        }
      } catch {
        // fall back to the config-declared type at write time
      }
    }
  }

  private async createSubscription(): Promise<void> {
    if (!this.session) return;
    this.subscription = await this.session.createSubscription2({
      requestedPublishingInterval: this.publishingIntervalMs,
      requestedLifetimeCount: 100,
      requestedMaxKeepAliveCount: 20,
      maxNotificationsPerPublish: 200,
      publishingEnabled: true,
      priority: 1,
    });
    for (const t of this.tagConfigs) {
      const item = await this.subscription.monitor(
        { nodeId: t.nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: this.samplingIntervalMs, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Neither,
      );
      const tagId = `${this.meta.id}.${t.name}`;
      item.on('changed', (dataValue: DataValue) => {
        const raw = dataValue.value.value as unknown;
        const value =
          t.dataType === 'boolean' ? raw === true : typeof raw === 'number' ? raw : Number(raw);
        if (typeof value === 'number' && !Number.isFinite(value)) return;
        this.lastValues.set(tagId, value);
        this.publish?.([{ tagId, value, ts: Date.now() }]);
      });
    }
  }
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConveyorAdapterConfig } from './adapters/conveyor';
import type { MemoryAdapterConfig } from './adapters/memory';
import type { MixerAdapterConfig } from './adapters/mixer';
import type { ModbusAdapterConfig } from './adapters/modbus';
import type { MqttAdapterConfig } from './adapters/mqtt';
import type { OpcUaAdapterConfig } from './adapters/opcua';
import type { PressAdapterConfig } from './adapters/press';
import type { S7AdapterConfig } from './adapters/s7';
import type { TiaWebAdapterConfig } from './adapters/tiaweb';
import type { LinkConfig } from './links';

export type AdapterConfigEntry =
  | { type: 'simulator'; id?: string }
  | ({ type: 'modbus' } & ModbusAdapterConfig)
  | ({ type: 'opcua' } & OpcUaAdapterConfig)
  | ({ type: 'mqtt' } & MqttAdapterConfig)
  | ({ type: 's7' } & S7AdapterConfig)
  | ({ type: 'tiaweb' } & TiaWebAdapterConfig)
  | ({ type: 'conveyor' } & ConveyorAdapterConfig)
  | ({ type: 'press' } & PressAdapterConfig)
  | ({ type: 'mixer' } & MixerAdapterConfig)
  | ({ type: 'memory' } & MemoryAdapterConfig);

export interface GatewayConfig {
  adapters: AdapterConfigEntry[];
  /** Tag-link bridge: route one adapter's tag into another's write (see links.ts). */
  links?: LinkConfig[];
}

const CONFIG_URL = new URL('../config.json', import.meta.url);

/** Load gateway/config.json; missing or broken config falls back to simulator-only. */
export function loadConfig(): GatewayConfig {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_URL, 'utf8')) as GatewayConfig;
    if (!Array.isArray(parsed.adapters)) throw new Error('config.adapters must be an array');
    if (parsed.links !== undefined && !Array.isArray(parsed.links))
      throw new Error('config.links must be an array');
    return parsed;
  } catch (err) {
    console.warn(
      `[config] ${fileURLToPath(CONFIG_URL)} not usable (${err instanceof Error ? err.message : err}) — using simulator only`,
    );
    return { adapters: [{ type: 'simulator' }] };
  }
}

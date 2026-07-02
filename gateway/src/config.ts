import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ModbusAdapterConfig } from './adapters/modbus';
import type { MqttAdapterConfig } from './adapters/mqtt';
import type { OpcUaAdapterConfig } from './adapters/opcua';

export type AdapterConfigEntry =
  | { type: 'simulator'; id?: string }
  | ({ type: 'modbus' } & ModbusAdapterConfig)
  | ({ type: 'opcua' } & OpcUaAdapterConfig)
  | ({ type: 'mqtt' } & MqttAdapterConfig);

export interface GatewayConfig {
  adapters: AdapterConfigEntry[];
}

const CONFIG_URL = new URL('../config.json', import.meta.url);

/** Load gateway/config.json; missing or broken config falls back to simulator-only. */
export function loadConfig(): GatewayConfig {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_URL, 'utf8')) as GatewayConfig;
    if (!Array.isArray(parsed.adapters)) throw new Error('config.adapters must be an array');
    return parsed;
  } catch (err) {
    console.warn(
      `[config] ${fileURLToPath(CONFIG_URL)} not usable (${err instanceof Error ? err.message : err}) — using simulator only`,
    );
    return { adapters: [{ type: 'simulator' }] };
  }
}

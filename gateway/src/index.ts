import { DEFAULT_GATEWAY_PORT } from '@sim/shared';
import { ModbusAdapter } from './adapters/modbus';
import { MqttAdapter } from './adapters/mqtt';
import { OpcUaAdapter } from './adapters/opcua';
import { S7Adapter } from './adapters/s7';
import { SimulatorAdapter } from './adapters/simulator';
import { TagBus } from './bus';
import { loadConfig } from './config';
import { startWsServer } from './server';

const PORT = Number(process.env.GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT);

const bus = new TagBus();
for (const entry of loadConfig().adapters) {
  switch (entry.type) {
    case 'simulator':
      bus.register(new SimulatorAdapter(entry.id));
      break;
    case 'modbus':
      bus.register(new ModbusAdapter(entry));
      break;
    case 'opcua':
      bus.register(new OpcUaAdapter(entry));
      break;
    case 'mqtt':
      bus.register(new MqttAdapter(entry));
      break;
    case 's7':
      bus.register(new S7Adapter(entry));
      break;
    default:
      console.warn(`[gateway] unknown adapter type in config: ${JSON.stringify(entry)}`);
  }
}
startWsServer(bus, PORT);

console.log(
  `[gateway] ws://localhost:${PORT} — ${bus.adapters.length} adapter(s), ${bus.tags.length} tags`,
);

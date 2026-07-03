import { DEFAULT_GATEWAY_PORT } from '@sim/shared';
import { ConveyorAdapter } from './adapters/conveyor';
import { MixerAdapter } from './adapters/mixer';
import { ModbusAdapter } from './adapters/modbus';
import { PressAdapter } from './adapters/press';
import { MqttAdapter } from './adapters/mqtt';
import { OpcUaAdapter } from './adapters/opcua';
import { S7Adapter } from './adapters/s7';
import { SimulatorAdapter } from './adapters/simulator';
import { TiaWebAdapter } from './adapters/tiaweb';
import { TagBus } from './bus';
import { loadConfig } from './config';
import { startLinks } from './links';
import { startWsServer } from './server';

const PORT = Number(process.env.GATEWAY_PORT ?? DEFAULT_GATEWAY_PORT);

const bus = new TagBus();
const config = loadConfig();
for (const entry of config.adapters) {
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
    case 'tiaweb':
      bus.register(await TiaWebAdapter.create(entry));
      break;
    case 'conveyor':
      bus.register(new ConveyorAdapter(entry));
      break;
    case 'press':
      bus.register(new PressAdapter(entry));
      break;
    case 'mixer':
      bus.register(new MixerAdapter(entry));
      break;
    default:
      console.warn(`[gateway] unknown adapter type in config: ${JSON.stringify(entry)}`);
  }
}
startLinks(bus, config.links ?? []);
startWsServer(bus, PORT);

console.log(
  `[gateway] ws://localhost:${PORT} — ${bus.adapters.length} adapter(s), ${bus.tags.length} tags`,
);

import type { AppLogger } from '@w3f/polguard-common';
import type { Store } from '../../types';
import type { ConfigService } from '../config/config.service';
import { InMemoryStore } from './in-memory.store';
import { FileStore } from './file.store';
import { ServiceStore } from './service.store';

/**
 * Creates the appropriate Store implementation based on configuration.
 */
export function createStore(config: ConfigService, logger: AppLogger): Store {
  const storeConfig = config.getStoreConfig();

  switch (storeConfig.type) {
    case 'service':
      return new ServiceStore(config, logger);
    case 'file':
      return new FileStore(storeConfig.file!.path, logger);
    case 'inMemory':
    default:
      return new InMemoryStore(logger);
  }
}

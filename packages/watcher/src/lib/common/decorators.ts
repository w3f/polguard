import { createHash } from 'crypto';
import { KeyValueStorageClient } from '@w3f/monitoring-types';
import { Chain } from '@w3f/monitoring-types';

const DEFAULT_TTL = 60;

type HandlerMetadata = {
  method: string;
  chains: Chain[];
};

function ensureHandlerMap<T>(target: any, mapName: string): Map<string, T> {
  if (!target.constructor.prototype[mapName]) {
    target.constructor.prototype[mapName] = new Map<string, T>();
  }
  return target.constructor.prototype[mapName];
}

/**
 * Decorates methods to handle specific chain events
 */
export function EventHandler(eventNames: string | string[], chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'eventHandlers');
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];

    names.forEach(name => {
      handlers.set(name, {
        method: propertyKey,
        chains,
      });
    });
    return descriptor;
  };
}

/**
 * Decorates methods to handle specific chain calls
 */
export function CallHandler(callNames: string | string[], chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'callHandlers');
    const names = Array.isArray(callNames) ? callNames : [callNames];

    names.forEach(name => {
      handlers.set(name, {
        method: propertyKey,
        chains,
      });
    });
    return descriptor;
  };
}

/**
 * Decorates methods to execute on every block
 */
export function EveryBlockHandler(chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'blockHandlers');
    handlers.set(propertyKey, {
      method: propertyKey,
      chains,
    });
    return descriptor;
  };
}

/**
 * Decorates methods to execute on telemetry data
 */
export function TelemetryHandler(chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'telemetryHandlers');
    handlers.set(propertyKey, {
      method: propertyKey,
      chains,
    });
    return descriptor;
  };
}

/**
 * Creates a decorator for caching method results
 */
export function createCachedQueryDecorator(cache: KeyValueStorageClient) {
  return function CachedQuery(ttl: number = DEFAULT_TTL) {
    return function <T>(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = createCacheKey(target.constructor.name, propertyKey, args);

        const cachedResult = await cache.get<T>(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        const result = await originalMethod.apply(this, args);
        await cache.setex(cacheKey, ttl, result);

        return result;
      };

      return descriptor;
    };
  };
}

function createCacheKey(className: string, methodName: string, args: any[]): string {
  const argsHash = createHash('md5').update(JSON.stringify(args)).digest('hex');
  return `${className}:${methodName}:${argsHash}`;
}

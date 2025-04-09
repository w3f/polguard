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
export function Event(eventNames: string | string[], chains: Chain[]) {
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
export function Call(callNames: string | string[], chains: Chain[]) {
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
 * Decorates methods to execute on every block for state monitoring
 */
export function State(chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'stateHandlers');
    handlers.set(propertyKey, {
      method: propertyKey,
      chains,
    });
    return descriptor;
  };
}

/**
 * Decorates methods to specify their handler type
 * @param handler The handler type enum value
 */
export function Handler(handler: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;
      // Call the original method with the enhanced params
      return originalMethod.call(this, params);
    };

    return descriptor;
  };
}

/**
 * Decorates methods to execute on telemetry data
 */
export function Telemetry(chains: Chain[]) {
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

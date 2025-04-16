import { createHash } from 'crypto';
import { KeyValueStorageClient, HandlerType, Chain } from '@w3f/monitoring-types';

const DEFAULT_TTL = 60;

type HandlerMetadata = {
  method: string;
  chains: Chain[];
  handler: HandlerType;
};

/**
 * Ensures that a handler map exists on the target's constructor prototype
 */
function ensureHandlerMap<T>(target: any, mapName: string): Map<string, T> {
  if (!target.constructor.prototype[mapName]) {
    target.constructor.prototype[mapName] = new Map<string, T>();
  }
  return target.constructor.prototype[mapName];
}

/**
 * Decorates methods to handle specific chain events
 */
export function Event(handler: HandlerType, chains: Chain[], eventNames: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Register event handlers
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'event');
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];

    names.forEach(name => {
      handlers.set(name, { method: propertyKey, chains, handler });
    });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method
      return await originalMethod.call(this, params);
    };

    return descriptor;
  };
}

/**
 * Decorates methods to handle specific chain calls
 */
export function Call(handler: HandlerType, chains: Chain[], callNames: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Register call handlers
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'call');
    const names = Array.isArray(callNames) ? callNames : [callNames];

    names.forEach(name => {
      handlers.set(name, { method: propertyKey, chains, handler });
    });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method
      return await originalMethod.call(this, params);
    };

    return descriptor;
  };
}

/**
 * Decorates methods to execute on every block for state monitoring
 */
export function State(handler: HandlerType, chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Register state handlers
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'state');
    handlers.set(propertyKey, { method: propertyKey, chains, handler });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method
      return await originalMethod.call(this, params);
    };

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

import { createHash } from 'crypto';
import { Chain, KeyValueStorageClient } from '@w3f/monitoring-types';

type HandlerMetadata = {
  method: string;
  chains: Chain[];
};

export function EventHandler(eventNames: string | string[], chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.prototype.eventHandlers) {
      target.constructor.prototype.eventHandlers = new Map<string, HandlerMetadata>();
    }
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    names.forEach(name => {
      target.constructor.prototype.eventHandlers.set(name, {
        method: propertyKey,
        chains,
      });
    });
    return descriptor;
  };
}

export function CallHandler(callNames: string | string[], chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.prototype.callHandlers) {
      target.constructor.prototype.callHandlers = new Map<string, HandlerMetadata>();
    }
    const names = Array.isArray(callNames) ? callNames : [callNames];
    names.forEach(name => {
      target.constructor.prototype.callHandlers.set(name, {
        method: propertyKey,
        chains,
      });
    });
    return descriptor;
  };
}

export function EveryBlockHandler(chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.prototype.everyBlockHandlers) {
      target.constructor.prototype.everyBlockHandlers = new Map<string, HandlerMetadata>();
    }
    target.constructor.prototype.everyBlockHandlers.set(propertyKey, {
      method: propertyKey,
      chains,
    });
    return descriptor;
  };
}

const DEFAULT_TTL = 60;

export function createCachedQueryDecorator(cache: KeyValueStorageClient) {
  return function CachedQuery(ttlSeconds: number = DEFAULT_TTL) {
    return function <T>(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = createCacheKey(target.constructor.name, propertyKey, args);

        const cachedResult = await cache.get<T>(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        const result = await originalMethod.apply(this, args);
        await cache.setex(cacheKey, ttlSeconds, result);

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

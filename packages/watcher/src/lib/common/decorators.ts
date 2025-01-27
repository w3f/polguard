import { createHash } from 'crypto';
import { KeyValueStorageClient } from '@w3f/monitoring-types';

const DEFAULT_TTL = 60;

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

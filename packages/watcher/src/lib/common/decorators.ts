import { createHash } from 'crypto';
import { KeyValueStorageClient, HandlerType, Chain, AlertSettings, IncidentKey } from '@w3f/monitoring-types';

// Interface for all incident notifications
export interface IncidentPayload {
  message: string[];
  alerts: AlertSettings;
  key: IncidentKey;
  blockNumber: number;
  isFiring?: boolean; // Optional for one-time incidents, required for ongoing incidents
}

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
 * Processes incident payloads and calls the appropriate incident method
 */
async function processIncidentPayloads(instance: any, payloads: IncidentPayload[]) {
  if (!Array.isArray(payloads)) return;

  for (const payload of payloads) {
    if (payload.isFiring !== undefined) {
      // If isFiring is present, use ongoingIncident
      await instance.incidents.ongoingIncident(
        payload.message,
        payload.alerts,
        payload.isFiring,
        payload.key,
        payload.blockNumber,
      );
    } else {
      // If isFiring is not present, use oneTimeIncident
      await instance.incidents.oneTimeIncident(payload.message, payload.alerts, payload.key, payload.blockNumber);
    }
  }
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

    // Add handler type to method params and process incident payloads
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method and get payloads
      const payloads: IncidentPayload[] = await originalMethod.call(this, params);

      // Process payloads
      await processIncidentPayloads(this, payloads);

      return payloads;
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

    // Add handler type to method params and process incident payloads
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method and get payloads
      const payloads: IncidentPayload[] = await originalMethod.call(this, params);

      // Process payloads
      await processIncidentPayloads(this, payloads);

      return payloads;
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

    // Add handler type to method params and process incident payloads
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method and get payloads
      const payloads: IncidentPayload[] = await originalMethod.call(this, params);

      // Process payloads
      await processIncidentPayloads(this, payloads);

      return payloads;
    };

    return descriptor;
  };
}

/**
 * Decorates methods to execute on telemetry data
 */
export function Telemetry(handler: HandlerType, chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Register telemetry handlers
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'telemetry');
    handlers.set(propertyKey, { method: propertyKey, chains, handler });

    // Add handler type to method params and process incident payloads
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handler = handler;

      // Call the original method and get payloads
      const payloads: IncidentPayload[] = await originalMethod.call(this, params);

      // Process payloads
      await processIncidentPayloads(this, payloads);

      return payloads;
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

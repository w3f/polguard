import { createHash } from 'crypto';
import { Chain, Store, HandlerType } from '../types';

/**
 * Handler Registration System
 *
 * This module contains decorators that register methods as handlers for chain events, calls, or state checks.
 * The decorators store metadata on the class prototype, which is later processed by AbstractMonitor.
 *
 * How it works:
 * 1. Decorators run at class definition time, before any instances are created
 * 2. They store metadata about handlers on the class prototype (e.g., BalancesMonitor.prototype.event)
 * 3. When a monitor instance is created, AbstractMonitor.initializeHandlers() reads this metadata
 * 4. It binds the handler methods to the instance and stores them in the instance's handlers maps
 * 5. When events/calls occur, the appropriate handlers are called based on the event/call name
 */

type HandlerMetadata = {
  method: string;
  chains: Chain[];
  handler: HandlerType;
};

/**
 * Decorates methods to handle specific chain events.
 * Registers a method to be called when events with matching names occur.
 */
export function Event(handler: HandlerType, chains: Chain[], eventNames: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Ensure event map exists
    if (!target.constructor.prototype.event) {
      target.constructor.prototype.event = new Map<string, HandlerMetadata[]>();
    }

    const eventMap = target.constructor.prototype.event;
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    const metadata = { method: propertyKey, chains, handler };

    // Register event handlers
    names.forEach(name => {
      const handlers = eventMap.get(name) || [];
      handlers.push(metadata);
      eventMap.set(name, handlers);
    });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handlerType = handler;
      return await originalMethod.call(this, params);
    };

    return descriptor;
  };
}

/**
 * Decorates methods to handle specific chain calls.
 * Registers a method to be called when extrinsic calls with matching names occur.
 */
export function Call(handler: HandlerType, chains: Chain[], callNames: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Ensure call map exists
    if (!target.constructor.prototype.call) {
      target.constructor.prototype.call = new Map<string, HandlerMetadata[]>();
    }

    const callMap = target.constructor.prototype.call;
    const names = Array.isArray(callNames) ? callNames : [callNames];
    const metadata = { method: propertyKey, chains, handler };

    // Register call handlers
    names.forEach(name => {
      const handlers = callMap.get(name) || [];
      handlers.push(metadata);
      callMap.set(name, handlers);
    });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handlerType = handler;
      return await originalMethod.call(this, params);
    };

    return descriptor;
  };
}

/**
 * Decorates methods to execute on every block for state monitoring.
 * Registers a method to be called on every block to check chain state.
 */
export function State(handler: HandlerType, chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Ensure state map exists
    if (!target.constructor.prototype.state) {
      target.constructor.prototype.state = new Map<string, HandlerMetadata>();
    }

    // Register state handler
    const stateMap = target.constructor.prototype.state;
    stateMap.set(propertyKey, { method: propertyKey, chains, handler });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handlerType = handler;
      return await originalMethod.call(this, params);
    };

    return descriptor;
  };
}

const DEFAULT_TTL = 60;
/**
 * Creates a decorator for caching method results
 */
export function createCachedQueryDecorator(store: Store) {
  return function CachedQuery(ttl: number = DEFAULT_TTL) {
    return function <T>(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const cacheKey = createCacheKey(target.constructor.name, propertyKey, args);

        const cachedResult = await store.get<T>(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        const result = await originalMethod.apply(this, args);
        await store.setex(cacheKey, ttl, result);

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

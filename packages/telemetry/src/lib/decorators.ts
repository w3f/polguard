import { HandlerType, Chain } from '@w3f/monitoring-types';

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
 * Decorates methods to execute on every iteration
 */
export function Telemetry(handler: HandlerType, chains: Chain[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Register state handlers
    const handlers = ensureHandlerMap<HandlerMetadata>(target, 'state');
    handlers.set(propertyKey, { method: propertyKey, chains, handler });

    // Add handler type to method params
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const params = args[0] || {};
      params.handlerType = handler;

      // Call the original method
      return await originalMethod.call(this, params);
    };

    return descriptor;
  };
}

import { Chain } from '@w3f/monitoring-types';

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

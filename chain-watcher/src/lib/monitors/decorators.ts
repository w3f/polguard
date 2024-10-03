export function EventHandler(eventName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    if (!target.constructor.prototype.eventHandlers) {
      target.constructor.prototype.eventHandlers = new Map<string, string>();
    }
    target.constructor.prototype.eventHandlers.set(eventName, propertyKey);
    return descriptor;
  };
}

export function CallHandler(callName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    if (!target.constructor.prototype.callHandlers) {
      target.constructor.prototype.callHandlers = new Map<string, string>();
    }
    target.constructor.prototype.callHandlers.set(callName, propertyKey);
    return descriptor;
  };
}

export function BlockHandler() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    if (!target.constructor.prototype.blockHandlers) {
      target.constructor.prototype.blockHandlers = new Set<string>();
    }
    target.constructor.prototype.blockHandlers.add(propertyKey);
    return descriptor;
  };
}

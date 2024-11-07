export function EventHandler(eventNames: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.prototype.eventHandlers) {
      target.constructor.prototype.eventHandlers = new Map<string, string>();
    }
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    names.forEach(name => {
      target.constructor.prototype.eventHandlers.set(name, propertyKey);
    });
    return descriptor;
  };
}

export function CallHandler(callNames: string | string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.prototype.callHandlers) {
      target.constructor.prototype.callHandlers = new Map<string, string>();
    }
    const names = Array.isArray(callNames) ? callNames : [callNames];
    names.forEach(name => {
      target.constructor.prototype.callHandlers.set(name, propertyKey);
    });
    return descriptor;
  };
}

export function EveryBlockHandler() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!target.constructor.prototype.everyBlockHandlers) {
      target.constructor.prototype.everyBlockHandlers = new Set<string>();
    }
    target.constructor.prototype.everyBlockHandlers.add(propertyKey);
    return descriptor;
  };
}

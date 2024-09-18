export function EventHandler(eventName: string) {
  return function (target: any, propertyKey: string) {
    if (!target.constructor.eventHandlers) {
      target.constructor.eventHandlers = new Map<string, string>();
    }
    target.constructor.eventHandlers.set(eventName, propertyKey);
  };
}
  
export function CallHandler(callName: string) {
  return function (target: any, propertyKey: string) {
    if (!target.constructor.callHandlers) {
      target.constructor.callHandlers = new Map<string, string>();
    }
    target.constructor.callHandlers.set(callName, propertyKey);
  };
}
  
export function BlockHandler() {
  return function (target: any, propertyKey: string) {
    if (!target.constructor.blockHandlers) {
      target.constructor.blockHandlers = new Set<string>();
    }
    target.constructor.blockHandlers.add(propertyKey);
  };
}
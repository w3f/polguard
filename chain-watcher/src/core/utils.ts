import { EventDispatcher } from './interfaces';

export function once(emitter: EventDispatcher, eventName: string | symbol): Promise<any[]> {
  return new Promise((resolve) => {
    const listener = (...args: any[]) => {
      emitter.off(eventName, listener);
      resolve(args);
    };
    emitter.on(eventName, listener);
  });
}

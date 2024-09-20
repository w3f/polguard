import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventDispatcher } from '@core/interfaces';

/**
 * Adapts Nest.js's EventEmitter2 to our core's EventDispatcher interface.
 * This ensures type compatibility and keeps our core logic framework-agnostic,
 * while allowing us to use Nest.js's event emitter implementation.
 */
@Injectable()
export class EventDispatcherAdapter implements EventDispatcher {
  constructor(private eventEmitter: EventEmitter2) {}

  emit(eventName: string | symbol, ...args: any[]): boolean {
    return this.eventEmitter.emit(eventName, ...args);
  }

  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(eventName, listener);
    return this;
  }

  once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.eventEmitter.once(eventName, listener);
    return this;
  }

  off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(eventName, listener);
    return this;
  }

}

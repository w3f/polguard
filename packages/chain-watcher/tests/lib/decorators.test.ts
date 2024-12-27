import { EventHandler, CallHandler, EveryBlockHandler } from '@lib/decorators';
import { Chain } from '@w3f/monitoring-types';

describe('Decorators', () => {
  describe('EventHandler', () => {
    it('should properly register event handlers', () => {
      class TestClass {
        @EventHandler('test.event', [Chain.Polkadot])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.eventHandlers.has('test.event')).toBe(true);
    });
  });

  describe('CallHandler', () => {
    it('should properly register call handlers', () => {
      class TestClass {
        @CallHandler('test.call', [Chain.Polkadot])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.callHandlers.has('test.call')).toBe(true);
    });

    it('should handle multiple call names', () => {
      class TestClass {
        @CallHandler(['test.call1', 'test.call2'], [Chain.Polkadot])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.callHandlers.has('test.call1')).toBe(true);
      expect(prototype.callHandlers.has('test.call2')).toBe(true);
    });
  });

  describe('EveryBlockHandler', () => {
    it('should properly register block handlers', () => {
      class TestClass {
        @EveryBlockHandler([Chain.Polkadot])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.everyBlockHandlers.has('handler')).toBe(true);
    });
  });

  describe('Handler Metadata', () => {
    it('should store correct metadata', () => {
      class TestClass {
        @EventHandler('test.event', [Chain.Polkadot, Chain.Kusama])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      const metadata = prototype.eventHandlers.get('test.event');
      
      expect(metadata).toEqual({
        method: 'handler',
        chains: [Chain.Polkadot, Chain.Kusama]
      });
    });

    it('should handle multiple decorators on same class', () => {
      class TestClass {
        @EventHandler('test.event1', [Chain.Polkadot])
        async handler1() {}

        @EventHandler('test.event2', [Chain.Kusama])
        async handler2() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.eventHandlers.size).toBe(2);
      expect(prototype.eventHandlers.get('test.event1').chains).toEqual([Chain.Polkadot]);
      expect(prototype.eventHandlers.get('test.event2').chains).toEqual([Chain.Kusama]);
    });

    it('should preserve existing handlers when adding new ones', () => {
      class TestClass {
        @EventHandler('test.event1', [Chain.Polkadot])
        async handler1() {}

        @CallHandler('test.call1', [Chain.Polkadot])
        async handler2() {}

        @EveryBlockHandler([Chain.Polkadot])
        async handler3() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.eventHandlers.size).toBe(1);
      expect(prototype.callHandlers.size).toBe(1);
      expect(prototype.everyBlockHandlers.size).toBe(1);
    });
  });
});
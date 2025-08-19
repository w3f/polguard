import { Event, Call, State } from '../../src/lib/decorators';
import { Chain, HandlerType } from '@w3f/monitoring-types';

describe('Decorators', () => {
  describe('Event', () => {
    it('should properly register event handlers', () => {
      class TestClass {
        @Event('EventHandler' as HandlerType, [Chain.Polkadot], 'test.event')
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.event.has('test.event')).toBe(true);
    });
  });

  describe('Call', () => {
    it('should properly register call handlers', () => {
      class TestClass {
        @Call('CallHandler' as HandlerType, [Chain.Polkadot], 'test.call')
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.call.has('test.call')).toBe(true);
    });

    it('should handle multiple call names', () => {
      class TestClass {
        @Call('CallHandler' as HandlerType, [Chain.Polkadot], ['test.call1', 'test.call2'])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.call.has('test.call1')).toBe(true);
      expect(prototype.call.has('test.call2')).toBe(true);
    });
  });

  describe('State', () => {
    it('should properly register state handlers', () => {
      class TestClass {
        @State('StateHandler' as HandlerType, [Chain.Polkadot])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.state.has('handler')).toBe(true);
    });
  });

  describe('Handler Metadata', () => {
    it('should store correct metadata', () => {
      class TestClass {
        @Event('EventHandler' as HandlerType, [Chain.Polkadot, Chain.Kusama], 'test.event')
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      const metadata = prototype.event.get('test.event');

      expect(metadata).toEqual([
        {
          method: 'handler',
          chains: [Chain.Polkadot, Chain.Kusama],
          handler: 'EventHandler',
        },
      ]);
    });

    it('should handle multiple decorators on same class', () => {
      class TestClass {
        @Event('EventHandler' as HandlerType, [Chain.Polkadot], 'test.event1')
        async handler1() {}

        @Event('EventHandler' as HandlerType, [Chain.Kusama], 'test.event2')
        async handler2() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.event.size).toBe(2);
      expect(prototype.event.get('test.event1')[0].chains).toEqual([Chain.Polkadot]);
      expect(prototype.event.get('test.event2')[0].chains).toEqual([Chain.Kusama]);
    });

    it('should preserve existing handlers when adding new ones', () => {
      class TestClass {
        @Event('EventHandler' as HandlerType, [Chain.Polkadot], 'test.event1')
        async handler1() {}

        @Call('CallHandler' as HandlerType, [Chain.Polkadot], 'test.call1')
        async handler2() {}

        @State('StateHandler' as HandlerType, [Chain.Polkadot])
        async handler3() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.event.size).toBe(1);
      expect(prototype.call.size).toBe(1);
      expect(prototype.state.size).toBe(1);
    });
  });
});

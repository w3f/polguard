import { Telemetry } from '@lib/decorators';
import { Chain, HandlerType } from '@w3f/monitoring-types';

describe('Decorators', () => {

  describe('Telemetry', () => {
    it('should properly register state handlers', () => {
      class TestClass {
        @Telemetry('TelemetryHandler' as HandlerType, [Chain.Polkadot])
        async handler() {}
      }

      const instance = new TestClass();
      const prototype = Object.getPrototypeOf(instance).constructor.prototype;
      expect(prototype.state.has('handler')).toBe(true);
    });
  });

});

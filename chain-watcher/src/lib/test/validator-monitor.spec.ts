import { MonitorTestSuite } from './monitor-test-suite';
import { MonitorType } from '@lib/constants';

describe('ValidatorMonitor', () => {
  let test: MonitorTestSuite;

  beforeAll(async () => {
    test = new MonitorTestSuite('wss://rpc-polkadot.luckyfriday.io');
    await test.initialize();
  });

  afterAll(async () => {
    await test.cleanup();
  });

  beforeEach(() => {
    test.clearMockAccounts();
  });

  it('should detect slash reported event', async () => {
    test.addMockAccount('14m8CmDmksk4cQ5YtvQzRva7J7B2gLCSSD8dwPfyH6WUahrG', MonitorType.Validator);
    await test.testEvent(MonitorType.Validator, 'staking.SlashReported', 21561307, 0);
    await test.testEvent(MonitorType.Validator, 'staking.SlashReported', 21561308, 1);
  });

  it('should detect commission change event', async () => {
    test.addMockAccount('15KJFabioS7ieTiNCkKkLpgZ5JUyPhTBF6y128R7Z6Rsx3kq', MonitorType.Validator);
    await test.testEvent(MonitorType.Validator, 'staking.ValidatorPrefsSet', 23408195, 0);
    await test.testEvent(MonitorType.Validator, 'staking.ValidatorPrefsSet', 23408196, 1);
  });

  it('should detect payee change call', async () => {
    test.addMockAccount('16B53xkLJwMhjZmetedubo8rnFi6ftX4aDx7ReNkvzJEGXkh', MonitorType.Validator);
    await test.testCall(MonitorType.Validator, 'staking.setPayee', 23407920, 0);
    await test.testCall(MonitorType.Validator, 'staking.setPayee', 23407921, 1);
    test.addMockAccount('12f3b57RjZzGEYJaPWB6BfsidXNvc8rZHUxeP7wmr4VEE4rS', MonitorType.Validator);
    await test.testCall(MonitorType.Validator, 'staking.bond', 23408563, 0);
    await test.testCall(MonitorType.Validator, 'staking.bond', 23408564, 1);
  });

  it('should detect unexpected commission change', async () => {
    test.addMockAccount('15Zx4M1W1caBHvwdQY6EjUDVoAv714eEBLcLCuE5A25RqiMH', MonitorType.Validator, { commission: 5 });
    await test.testEveryBlock(MonitorType.Validator, 'handleCommissionUnexpected', 23408564, 0);
    test.clearMockAccounts();
    test.addMockAccount('15Zx4M1W1caBHvwdQY6EjUDVoAv714eEBLcLCuE5A25RqiMH', MonitorType.Validator, { commission: 7 });
    await test.testEveryBlock(MonitorType.Validator, 'handleCommissionUnexpected', 23408564, 1);
  });

  it('should detect unexpected destination change', async () => {
    test.addMockAccount('15Zx4M1W1caBHvwdQY6EjUDVoAv714eEBLcLCuE5A25RqiMH', MonitorType.Validator, { payee: 'Staked' });
    await test.testEveryBlock(MonitorType.Validator, 'handleDestinationUnexpected', 23408564, 0);
    test.clearMockAccounts();
    test.addMockAccount('15Zx4M1W1caBHvwdQY6EjUDVoAv714eEBLcLCuE5A25RqiMH', MonitorType.Validator, {
      payee: 'some-payee',
    });
    await test.testEveryBlock(MonitorType.Validator, 'handleDestinationUnexpected', 23408564, 1);
  });

  it('should detect not presense in the active set', async () => {
    test.addMockAccount('1o6KaLJCHyz2CoTkxBmqabvrPHyhcpnjn4jCbt16mPgEx8v', MonitorType.Validator);
    await test.testEveryBlock(MonitorType.Validator, 'handleActiveSetPresense', 23409154, 0);
    await test.testEveryBlock(MonitorType.Validator, 'handleActiveSetPresense', 10000000, 1);
  });
});

import { Logger, DataStoreClient } from '@lib/interfaces';

export const createMockLogger = (): Logger => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  fatal: jest.fn(),
});

export const createMockStore = (): DataStoreClient => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  setex: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  keys: jest.fn().mockResolvedValue([]),

  getLastProcessedBlock: jest.fn().mockResolvedValue(null),
  setLastProcessedBlock: jest.fn().mockResolvedValue(undefined),
  getOngoingIncident: jest.fn().mockResolvedValue(null),
  setOngoingIncident: jest.fn().mockResolvedValue(undefined),
  deleteOngoingIncident: jest.fn().mockResolvedValue(undefined),

  clearAll: jest.fn().mockResolvedValue(undefined),
});

import pino from 'pino';

/**
 * Creates the root pino logger for the chain service.
 * Child loggers are created via rootLogger.child({ context: 'Name' }).
 */
export function createRootLogger(level: string): pino.Logger {
  return pino({
    level: pinoLevel(level),
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  });
}

/**
 * Maps config log level names to pino levels.
 * Config uses 'verbose' while pino uses 'trace'.
 */
function pinoLevel(configLevel: string): string {
  if (configLevel === 'verbose') return 'trace';
  return configLevel;
}

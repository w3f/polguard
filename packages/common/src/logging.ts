export interface Logger {
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  log(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  fatal(message: string, ...args: any[]): void;
}

// TODO: migrate all the service to use AppLogger instead of Logger
export interface AppLogger {
  fatal(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
  trace(msg: string, ...args: any[]): void;
}

const LOG_LEVEL_MAP: Record<string, ('error' | 'warn' | 'log' | 'debug' | 'verbose')[]> = {
  'error': ['error'],
  'warn': ['error', 'warn'],
  'info': ['error', 'warn', 'log'],
  'debug': ['error', 'warn', 'log', 'debug'],
  'verbose': ['error', 'warn', 'log', 'debug', 'verbose']
};

/**
 * Get log levels array from configuration log level string
 * @param configLogLevel - The log level from configuration ('error', 'warn', 'info', 'debug', 'verbose')
 * @returns Array of log levels
 */
export function getLogLevels(configLogLevel: string): ('error' | 'warn' | 'log' | 'debug' | 'verbose')[] {
  return LOG_LEVEL_MAP[configLogLevel] || LOG_LEVEL_MAP['info'];
}

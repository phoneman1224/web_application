/**
 * Structured Logger for Cloudflare Workers
 * Provides environment-aware logging with JSON formatting for production
 */

export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
}

/**
 * Create a logger instance based on environment
 *
 * @param environment - Environment name (PRODUCTION, TEST, etc.)
 * @returns Logger instance
 */
export function createLogger(environment?: string): Logger {
  const isProduction = environment === 'PRODUCTION';
  const isDevelopment = !isProduction;

  function formatLog(level: LogEntry['level'], message: string, meta?: Record<string, any>): string {
    if (isProduction) {
      // Production: Structured JSON logs for parsing
      const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(meta && { meta })
      };
      return JSON.stringify(entry);
    } else {
      // Development: Human-readable logs
      const prefix = `[${level.toUpperCase()}]`;
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      return `${prefix} ${message}${metaStr}`;
    }
  }

  return {
    debug(message: string, meta?: Record<string, any>): void {
      if (isDevelopment) {
        console.log(formatLog('debug', message, meta));
      }
      // In production, debug logs are suppressed
    },

    info(message: string, meta?: Record<string, any>): void {
      console.log(formatLog('info', message, meta));
    },

    warn(message: string, meta?: Record<string, any>): void {
      console.warn(formatLog('warn', message, meta));
    },

    error(message: string, meta?: Record<string, any>): void {
      console.error(formatLog('error', message, meta));
    }
  };
}

/**
 * Global logger instance (initialized once per worker instance)
 * Note: In Cloudflare Workers, this will be reinitialized on cold starts
 */
let _logger: Logger | null = null;

/**
 * Get or create the global logger instance
 *
 * @param environment - Environment name (only used on first call)
 * @returns Global logger instance
 */
export function getLogger(environment?: string): Logger {
  if (!_logger) {
    _logger = createLogger(environment);
  }
  return _logger;
}

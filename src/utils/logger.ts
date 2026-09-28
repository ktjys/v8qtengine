/**
 * Structured logging utility with correlation IDs for distributed tracing.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  component?: string;
  operation?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
  error?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
}

class Logger {
  private static instance: Logger;
  private correlationIdCounter = 0;
  private logLevel: LogLevel = 'info';

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  generateCorrelationId(): string {
    return `corr_${Date.now()}_${++this.correlationIdCounter}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }

  private formatEntry(level: LogLevel, message: string, context: LogContext = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        correlationId: context.correlationId || this.generateCorrelationId(),
        component: context.component,
        operation: context.operation,
        durationMs: context.durationMs,
        metadata: context.metadata,
      },
    };
  }

  private output(entry: LogEntry) {
    const logLine = JSON.stringify(entry);
    switch (entry.level) {
      case 'debug':
      case 'info':
        console.log(logLine);
        break;
      case 'warn':
        console.warn(logLine);
        break;
      case 'error':
        console.error(logLine);
        break;
    }
  }

  debug(message: string, context: LogContext = {}) {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }

  info(message: string, context: LogContext = {}) {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }

  warn(message: string, context: LogContext = {}) {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }

  error(message: string, context: LogContext = {}) {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, context));
    }
  }

  /**
   * Time an operation and log its duration
   */
  async time<T>(operation: string, fn: () => Promise<T>, context: LogContext = {}): Promise<T> {
    const correlationId = context.correlationId || this.generateCorrelationId();
    const start = Date.now();
    this.info(`Starting ${operation}`, { ...context, correlationId, operation });
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.info(`Completed ${operation}`, { ...context, correlationId, operation, durationMs });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      this.error(`Failed ${operation}: ${err instanceof Error ? err.message : String(err)}`, {
        ...context,
        correlationId,
        operation,
        durationMs,
      });
      throw err;
    }
  }

  /**
   * Create a child logger with preset context
   */
  child(context: LogContext): Logger {
    const child = Object.create(this);
    child.info = (msg: string, ctx: LogContext = {}) => this.info(msg, { ...context, ...ctx });
    child.debug = (msg: string, ctx: LogContext = {}) => this.debug(msg, { ...context, ...ctx });
    child.warn = (msg: string, ctx: LogContext = {}) => this.warn(msg, { ...context, ...ctx });
    child.error = (msg: string, ctx: LogContext = {}) => this.error(msg, { ...context, ...ctx });
    child.time = (op: string, fn: () => Promise<any>, ctx: LogContext = {}) =>
      this.time(op, fn, { ...context, ...ctx });
    child.child = (ctx: LogContext) => this.child({ ...context, ...ctx });
    return child;
  }
}

export const logger = Logger.getInstance();

// Convenience function for timed operations
export async function withLogging<T>(
  operation: string,
  fn: () => Promise<T>,
  context: LogContext = {}
): Promise<T> {
  return logger.time(operation, fn, context);
}
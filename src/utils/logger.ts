export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  private static level: LogLevel = "info";
  private static enableConsole = true;

  static configure(level: LogLevel, enableConsole = true): void {
    Logger.level = level;
    Logger.enableConsole = enableConsole;
  }

  static debug(message: string, context?: LogContext): void {
    Logger.log("debug", message, context);
  }

  static info(message: string, context?: LogContext): void {
    Logger.log("info", message, context);
  }

  static warn(message: string, context?: LogContext): void {
    Logger.log("warn", message, context);
  }

  static error(message: string, error?: Error | LogContext): void {
    const context = error instanceof Error
      ? { error: error.message, stack: error.stack }
      : error;
    Logger.log("error", message, context);
  }

  private static log(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    if (!Logger.shouldLog(level) || !Logger.enableConsole) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);

    let logMessage = `[${timestamp}] ${levelStr} ${message}`;

    if (context && Object.keys(context).length > 0) {
      logMessage += ` ${JSON.stringify(context)}`;
    }

    switch (level) {
      case "error":
        console.error(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "debug":
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  private static shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[Logger.level];
  }
}

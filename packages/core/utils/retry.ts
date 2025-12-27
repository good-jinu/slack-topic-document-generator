import { Logger } from "./logger.ts";

export interface RetryOptions {
  maxRetries: number;
  delay: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Execute an operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    delay,
    backoffMultiplier = 1.5,
    maxDelay = 30000,
  } = options;

  let lastError: Error;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      Logger.debug(`Executing operation, attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      Logger.warn(`Operation failed on attempt ${attempt}/${maxRetries}`, {
        error: lastError.message,
        attempt,
        maxRetries,
      });

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      Logger.debug(`Waiting ${currentDelay}ms before retry`);
      await new Promise((resolve) => setTimeout(resolve, currentDelay));

      // Increase delay for next attempt (exponential backoff)
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
    }
  }

  throw new RetryError(
    `Operation failed after ${maxRetries} attempts: ${lastError!.message}`,
    maxRetries,
    lastError!,
  );
}

/**
 * Create a retry wrapper for a function
 */
export function createRetryWrapper<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return await withRetry(() => fn(...args), options);
  };
}

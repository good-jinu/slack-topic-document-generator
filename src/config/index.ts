import { load } from "std/dotenv";

export interface AppConfig {
  ai: {
    model: string;
    rateLimitDelay: number;
    maxRetries: number;
    apiKey: string;
  };
  database: {
    path: string;
    backupEnabled: boolean;
  };
  output: {
    documentsPath: string;
    format: "markdown" | "html";
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableConsole: boolean;
  };
}

/**
 * Load and validate application configuration
 */
export async function loadConfig(): Promise<AppConfig> {
  await load();

  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is required");
  }

  return {
    ai: {
      model: Deno.env.get("AI_MODEL") || "gemini-2.5-flash-lite",
      rateLimitDelay: parseInt(Deno.env.get("AI_RATE_LIMIT_DELAY") || "10000"),
      maxRetries: parseInt(Deno.env.get("AI_MAX_RETRIES") || "3"),
      apiKey,
    },
    database: {
      path: Deno.env.get("DATABASE_PATH") || "slack_messages.db",
      backupEnabled: Deno.env.get("DATABASE_BACKUP_ENABLED") === "true",
    },
    output: {
      documentsPath: Deno.env.get("DOCUMENTS_PATH") || "db_docs",
      format: (Deno.env.get("OUTPUT_FORMAT") as "markdown" | "html") ||
        "markdown",
    },
    logging: {
      level:
        (Deno.env.get("LOG_LEVEL") as "debug" | "info" | "warn" | "error") ||
        "info",
      enableConsole: Deno.env.get("LOG_CONSOLE") !== "false",
    },
  };
}

/**
 * Validate configuration values
 */
export function validateConfig(config: AppConfig): void {
  if (config.ai.rateLimitDelay < 0) {
    throw new Error("AI rate limit delay must be non-negative");
  }

  if (config.ai.maxRetries < 1) {
    throw new Error("AI max retries must be at least 1");
  }

  if (!config.ai.apiKey.trim()) {
    throw new Error("AI API key cannot be empty");
  }

  if (!config.database.path.trim()) {
    throw new Error("Database path cannot be empty");
  }

  if (!config.output.documentsPath.trim()) {
    throw new Error("Documents path cannot be empty");
  }
}

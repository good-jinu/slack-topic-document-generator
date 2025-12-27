import { DB } from "sqlite";
import { Logger } from "@/shared/utils/logger.ts";
import { AppConfig } from "@/shared/config/index.ts";
import { initDatabase } from "@/db/index.ts";

export class DatabaseService {
  private config: AppConfig;
  private db: DB | null = null;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Get database connection (lazy initialization)
   */
  getConnection(): DB {
    if (!this.db) {
      Logger.info(
        `Initializing database connection: ${this.config.database.path}`,
      );
      this.db = initDatabase(this.config.database.path);
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      Logger.debug("Closing database connection");
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Create database backup if enabled
   */
  async createBackup(): Promise<string | null> {
    if (!this.config.database.backupEnabled) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${this.config.database.path}.backup.${timestamp}`;

    try {
      Logger.info(`Creating database backup: ${backupPath}`);
      await Deno.copyFile(this.config.database.path, backupPath);
      Logger.info(`Database backup created successfully: ${backupPath}`);
      return backupPath;
    } catch (error) {
      Logger.error(
        "Failed to create database backup",
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  /**
   * Check database health
   */
  checkHealth(): boolean {
    try {
      const db = this.getConnection();
      // Simple health check - try to query a table
      db.queryEntries(
        "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1",
      );
      Logger.debug("Database health check passed");
      return true;
    } catch (error) {
      Logger.error(
        "Database health check failed",
        error instanceof Error ? error : undefined,
      );
      return false;
    }
  }

  /**
   * Get database statistics
   */
  getStatistics(): {
    messageCount: number;
    userCount: number;
    groupCount: number;
    documentCount: number;
  } {
    const db = this.getConnection();

    const messageCount = db.queryEntries<{ count: number }>(
      "SELECT COUNT(*) as count FROM messages",
    )[0].count;

    const userCount = db.queryEntries<{ count: number }>(
      "SELECT COUNT(*) as count FROM users",
    )[0].count;

    const groupCount = db.queryEntries<{ count: number }>(
      "SELECT COUNT(*) as count FROM groups",
    )[0].count;

    const documentCount = db.queryEntries<{ count: number }>(
      "SELECT COUNT(*) as count FROM documents",
    )[0].count;

    return {
      messageCount,
      userCount,
      groupCount,
      documentCount,
    };
  }
}

import { DB } from "sqlite";

/**
 * Migrate existing database to new schema
 * This merges the groups table into the users table with user_type column
 */
export function migrateDatabase(db: DB): void {
  console.log("Starting database migration...");

  try {
    // Check if migration is needed by looking for the groups table
    const tablesResult = db.queryEntries<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='groups'",
    );

    if (tablesResult.length === 0) {
      console.log("No migration needed - groups table doesn't exist");
      return;
    }

    // Start transaction
    db.execute("BEGIN TRANSACTION");

    // 1. Add user_type column to users table if it doesn't exist
    try {
      db.execute(
        "ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'user' CHECK (user_type IN ('user', 'group'))",
      );
      console.log("Added user_type column to users table");
    } catch (error) {
      // Column might already exist, check the error
      if (
        error instanceof Error &&
        !error.message.includes("duplicate column name")
      ) {
        throw error;
      }
      console.log("user_type column already exists");
    }

    // 2. Migrate groups to users table
    const groups = db.queryEntries<
      { group_id: string; group_name: string; handle: string }
    >(
      "SELECT group_id, group_name, handle FROM groups",
    );

    if (groups.length > 0) {
      const stmt = db.prepareQuery(`
        INSERT OR REPLACE INTO users (user_id, user_name, nickname, user_type)
        VALUES (?, ?, ?, 'group')
      `);

      try {
        for (const group of groups) {
          stmt.execute([
            group.group_id,
            group.group_name,
            group.handle || group.group_name,
          ]);
        }
        console.log(`Migrated ${groups.length} groups to users table`);
      } finally {
        stmt.finalize();
      }
    }

    // 3. Add mention_type column to mentions table if it doesn't exist
    try {
      db.execute(
        "ALTER TABLE mentions ADD COLUMN mention_type TEXT NOT NULL DEFAULT 'user' CHECK (mention_type IN ('user', 'group'))",
      );
      console.log("Added mention_type column to mentions table");
    } catch (error) {
      // Column might already exist, check the error
      if (
        error instanceof Error &&
        !error.message.includes("duplicate column name")
      ) {
        throw error;
      }
      console.log("mention_type column already exists");
    }

    // 4. Update mention_type for existing group mentions
    // This is a best-effort approach - we'll mark mentions that reference group IDs
    const groupIds = groups.map((g) => g.group_id);
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => "?").join(",");
      const stmt = db.prepareQuery(
        `UPDATE mentions SET mention_type = 'group' WHERE user_id IN (${placeholders})`,
      );
      try {
        const updateResult = stmt.execute(groupIds);
        console.log(`Updated mention records to group type`);
      } finally {
        stmt.finalize();
      }
    }

    // 5. Drop the groups table
    db.execute("DROP TABLE groups");
    console.log("Dropped groups table");

    // Commit transaction
    db.execute("COMMIT");
    console.log("Database migration completed successfully!");
  } catch (error) {
    // Rollback on error
    try {
      db.execute("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    console.error("Migration failed:", error);
    throw error;
  }
}

/**
 * CLI interface for migration
 */
if (import.meta.main) {
  const dbPath = Deno.args[0] || "slack_messages.db";

  try {
    const db = new DB(dbPath);
    migrateDatabase(db);
    db.close();
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    Deno.exit(1);
  }
}

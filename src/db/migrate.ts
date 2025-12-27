import { DB } from "sqlite";

/**
 * Migrate existing database to new schema
 * This merges the groups table into the users table with user_type column
 * and converts documents table to topics table
 */
export function migrateDatabase(db: DB): void {
  console.log("Starting database migration...");

  try {
    // Start transaction
    db.execute("BEGIN TRANSACTION");

    // Migration 1: Groups to Users migration
    migrateGroupsToUsers(db);

    // Migration 2: Documents to Topics migration
    migrateDocumentsToTopics(db);

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
 * Migrate groups table to users table
 */
function migrateGroupsToUsers(db: DB): void {
  // Check if migration is needed by looking for the groups table
  const tablesResult = db.queryEntries<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='groups'",
  );

  if (tablesResult.length === 0) {
    console.log("No groups migration needed - groups table doesn't exist");
    return;
  }

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
      stmt.execute(groupIds);
      console.log(`Updated mention records to group type`);
    } finally {
      stmt.finalize();
    }
  }

  // 5. Drop the groups table
  db.execute("DROP TABLE groups");
  console.log("Dropped groups table");
}

/**
 * Migrate documents table to topics table
 */
function migrateDocumentsToTopics(db: DB): void {
  // Check if migration is needed by looking for the documents table
  const documentsTableResult = db.queryEntries<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='documents'",
  );

  if (documentsTableResult.length === 0) {
    console.log("No documents migration needed - documents table doesn't exist");
    return;
  }

  // Check if topics table already exists
  const topicsTableResult = db.queryEntries<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='topics'",
  );

  if (topicsTableResult.length > 0) {
    console.log("Topics table already exists, skipping documents migration");
    return;
  }

  // 1. Create the new topics table
  db.execute(`
    CREATE TABLE topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_name TEXT UNIQUE,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  console.log("Created topics table");

  // 2. Migrate existing documents to topics
  const documents = db.queryEntries<
    { id: number; name: string; created_at: string; updated_at: string }
  >(
    "SELECT id, name, created_at, updated_at FROM documents",
  );

  if (documents.length > 0) {
    const stmt = db.prepareQuery(`
      INSERT INTO topics (id, title, file_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      for (const doc of documents) {
        // Extract title from filename (remove .md extension and convert hyphens to spaces)
        const title = doc.name.replace(/\.md$/, "").replace(/-/g, " ");
        stmt.execute([
          doc.id,
          title,
          doc.name,
          doc.created_at,
          doc.updated_at,
        ]);
      }
      console.log(`Migrated ${documents.length} documents to topics table`);
    } finally {
      stmt.finalize();
    }
  }

  // 3. Create the new message_topic_relations table
  db.execute(`
    CREATE TABLE message_topic_relations (
      message_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      PRIMARY KEY (message_id, topic_id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    )
  `);
  console.log("Created message_topic_relations table");

  // 4. Migrate existing message_document_relations to message_topic_relations
  const relations = db.queryEntries<
    { message_id: number; document_id: number }
  >(
    "SELECT message_id, document_id FROM message_document_relations",
  );

  if (relations.length > 0) {
    const stmt = db.prepareQuery(`
      INSERT INTO message_topic_relations (message_id, topic_id)
      VALUES (?, ?)
    `);

    try {
      for (const relation of relations) {
        stmt.execute([relation.message_id, relation.document_id]);
      }
      console.log(`Migrated ${relations.length} message relations to topics`);
    } finally {
      stmt.finalize();
    }
  }

  // 5. Drop the old tables
  db.execute("DROP TABLE message_document_relations");
  db.execute("DROP TABLE documents");
  console.log("Dropped old documents and message_document_relations tables");
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

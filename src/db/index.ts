import { DB } from "sqlite";
import { Mention, SlackMessage, User } from "../utils/types.ts";
import { migrateDatabase } from "./migrate.ts";

/**
 * Initialize SQLite database and create table
 */
export function initDatabase(dbPath = "slack_messages.db"): DB {
  const db = new DB(dbPath);

  // Run migration first if needed
  migrateDatabase(db);

  db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      user_id TEXT NOT NULL,
      user_name TEXT,
      text TEXT,
      ts TEXT NOT NULL,
      thread_id TEXT,
      permalink TEXT,
      created_at TEXT NOT NULL,
      mention_type TEXT,
      UNIQUE(channel_id, ts)
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      nickname TEXT,
      user_type TEXT NOT NULL DEFAULT 'user' CHECK (user_type IN ('user', 'group'))
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS mentions (
      channel_id TEXT NOT NULL,
      message_ts TEXT NOT NULL,
      user_id TEXT NOT NULL,
      mention_type TEXT NOT NULL DEFAULT 'user' CHECK (mention_type IN ('user', 'group')),
      PRIMARY KEY (channel_id, message_ts, user_id)
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS message_document_relations (
      message_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL,
      PRIMARY KEY (message_id, document_id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )
  `);

  console.log(`Database initialized: ${dbPath}`);
  return db;
}

/**
 * Insert messages into SQLite database
 */
export function saveMessages(db: DB, messages: SlackMessage[]) {
  const stmt = db.prepareQuery(`
    INSERT OR REPLACE INTO messages 
    (channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    let insertedCount = 0;
    for (const msg of messages) {
      stmt.execute([
        msg.channel_id,
        msg.channel_name,
        msg.user_id,
        msg.user_name,
        msg.text,
        msg.ts,
        msg.thread_id ?? null,
        msg.permalink,
        msg.created_at,
        msg.mention_type ?? null,
      ]);
      insertedCount++;
    }
    console.log(`Saved ${insertedCount} messages to database`);
  } finally {
    stmt.finalize();
  }
}

/**
 * Insert users and groups into SQLite database
 */
export function saveUsers(
  db: DB,
  users: {
    user_id: string;
    user_name: string;
    nickname: string;
    user_type?: string;
  }[],
) {
  const stmt = db.prepareQuery(`
    INSERT OR REPLACE INTO users (user_id, user_name, nickname, user_type)
    VALUES (?, ?, ?, ?)
  `);

  try {
    for (const user of users) {
      stmt.execute([
        user.user_id,
        user.user_name,
        user.nickname,
        user.user_type || "user",
      ]);
    }
    console.log(`Saved ${users.length} users to database`);
  } finally {
    stmt.finalize();
  }
}

/**
 * Insert mentions into SQLite database
 */
export function saveMentions(
  db: DB,
  mentions: {
    channel_id: string;
    message_ts: string;
    user_id: string;
    mention_type?: string;
  }[],
) {
  const stmt = db.prepareQuery(`
    INSERT OR REPLACE INTO mentions (channel_id, message_ts, user_id, mention_type)
    VALUES (?, ?, ?, ?)
  `);

  try {
    for (const mention of mentions) {
      stmt.execute([
        mention.channel_id,
        mention.message_ts,
        mention.user_id,
        mention.mention_type || "user",
      ]);
    }
    console.log(`Saved ${mentions.length} mentions to database`);
  } finally {
    stmt.finalize();
  }
}

/**
 * Fetch messages from the database
 */
export function getMessages(db: DB, limit?: number): SlackMessage[] {
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const query = db.queryEntries<SlackMessage>(`
    SELECT 
      channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type 
    FROM messages 
    ORDER BY created_at DESC
    ${limitClause}
  `);

  return query;
}

/**
 * Fetch users from the database
 */
export function getUsers(db: DB, limit?: number): User[] {
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const query = db.queryEntries<User>(`
    SELECT user_id, user_name, nickname FROM users WHERE user_type = 'user' ${limitClause}
  `);
  return query;
}

/**
 * Fetch groups from the database (now from users table)
 */
export function getGroups(
  db: DB,
  limit?: number,
): { group_id: string; group_name: string; handle: string }[] {
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const query = db.queryEntries<
    { user_id: string; user_name: string; nickname: string }
  >(`
    SELECT user_id, user_name, nickname FROM users WHERE user_type = 'group' ${limitClause}
  `);

  // Map to the expected format for backward compatibility
  return query.map((row) => ({
    group_id: row.user_id,
    group_name: row.user_name,
    handle: row.nickname || "",
  }));
}
/**
 * Get group name for a given group ID.
 * Returns null if the group does not exist.
 */
export function getGroupName(db: DB, groupId: string): string | null {
  try {
    const rows = db.queryEntries<{ user_name: string; nickname: string }>(
      `SELECT user_name, nickname FROM users WHERE user_id = ? AND user_type = 'group'`,
      [groupId],
    );
    if (rows.length > 0) {
      const { user_name, nickname } = rows[0];
      return nickname && nickname.length > 0 ? nickname : user_name;
    }
  } catch {
    // ignore errors
  }
  return null;
}
/**
 * Get display name (nickname or user_name) for a given user ID.
 * Returns null if the user does not exist.
 */
export function getUserName(db: DB, userId: string): string | null {
  try {
    const rows = db.queryEntries<{ nickname: string; user_name: string }>(
      `SELECT nickname, user_name FROM users WHERE user_id = ? AND user_type = 'user'`,
      [userId],
    );
    if (rows.length > 0) {
      const { nickname, user_name } = rows[0];
      return nickname && nickname.length > 0 ? nickname : user_name;
    }
  } catch {
    // ignore errors
  }
  return null;
}

/**
 * Fetch mentions from the database
 */
export function getMentions(
  db: DB,
  limit?: number,
): (Mention & { mention_type: string })[] {
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const query = db.queryEntries<Mention & { mention_type: string }>(`
    SELECT channel_id, message_ts, user_id, mention_type FROM mentions ${limitClause}
  `);
  return query;
}

/**
 * Insert or update documents in SQLite database
 */
export function saveDocument(
  db: DB,
  name: string,
  isUpdate = false,
): number {
  const now = new Date().toISOString();

  if (isUpdate) {
    // Update existing document
    const stmt = db.prepareQuery(`
      UPDATE documents SET updated_at = ? WHERE name = ?
    `);
    try {
      stmt.execute([now, name]);
    } finally {
      stmt.finalize();
    }

    // Get the document ID
    const result = db.queryEntries<{ id: number }>(
      `
      SELECT id FROM documents WHERE name = ?
    `,
      [name],
    );

    return result[0].id;
  } else {
    // Check if document already exists
    const existing = getDocumentByName(db, name);
    if (existing) {
      console.log(`Document already exists, updating instead: ${name}`);
      return saveDocument(db, name, true);
    }

    // Insert new document
    const stmt = db.prepareQuery(`
      INSERT INTO documents (name, created_at, updated_at)
      VALUES (?, ?, ?)
    `);

    try {
      stmt.execute([name, now, now]);
      console.log(`Saved document: ${name}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        console.log(`Document already exists due to race condition, updating instead: ${name}`);
        return saveDocument(db, name, true);
      }
      throw error;
    } finally {
      stmt.finalize();
    }

    // Get the inserted document ID
    const insertedId = db.lastInsertRowId;
    if (typeof insertedId !== "number") {
      throw new Error("Failed to get inserted document ID");
    }
    return insertedId;
  }
}

/**
 * Get document by name
 */
export function getDocumentByName(
  db: DB,
  name: string,
): { id: number; name: string; created_at: string; updated_at: string } | null {
  const result = db.queryEntries<
    { id: number; name: string; created_at: string; updated_at: string }
  >(
    `
    SELECT id, name, created_at, updated_at FROM documents WHERE name = ?
  `,
    [name],
  );

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all documents
 */
export function getDocuments(
  db: DB,
  limit?: number,
): { id: number; name: string; created_at: string; updated_at: string }[] {
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const query = db.queryEntries<
    { id: number; name: string; created_at: string; updated_at: string }
  >(`
    SELECT id, name, created_at, updated_at FROM documents 
    ORDER BY updated_at DESC
    ${limitClause}
  `);
  return query;
}

/**
 * Insert message-document relations into SQLite database
 */
export function saveMessageDocumentRelations(
  db: DB,
  relations: { message_id: number; document_id: number }[],
) {
  const stmt = db.prepareQuery(`
    INSERT OR REPLACE INTO message_document_relations (message_id, document_id)
    VALUES (?, ?)
  `);

  try {
    for (const relation of relations) {
      stmt.execute([relation.message_id, relation.document_id]);
    }
    console.log(
      `Saved ${relations.length} message-document relations to database`,
    );
  } finally {
    stmt.finalize();
  }
}

/**
 * Fetch message-document relations from the database
 */
export function getMessageDocumentRelations(
  db: DB,
  messageId?: number,
  documentId?: number,
  limit?: number,
): { message_id: number; document_id: number; document_name?: string }[] {
  let whereClause = "";
  const params: number[] = [];

  if (messageId !== undefined) {
    whereClause = "WHERE mdr.message_id = ?";
    params.push(messageId);
  } else if (documentId !== undefined) {
    whereClause = "WHERE mdr.document_id = ?";
    params.push(documentId);
  }

  const limitClause = limit ? `LIMIT ${limit}` : "";

  const query = db.queryEntries<
    { message_id: number; document_id: number; document_name: string }
  >(
    `
    SELECT mdr.message_id, mdr.document_id, d.name as document_name 
    FROM message_document_relations mdr
    JOIN documents d ON mdr.document_id = d.id
    ${whereClause}
    ORDER BY mdr.message_id DESC
    ${limitClause}
  `,
    params,
  );

  return query;
}

/**
 * Clear all documents and related message-document relations
 */
export function clearDocuments(db: DB): void {
  try {
    // Delete all message-document relations first (due to foreign key constraints)
    db.execute("DELETE FROM message_document_relations");

    // Delete all documents
    db.execute("DELETE FROM documents");

    console.log("Cleared all documents and related relations from database");
  } catch (error) {
    console.error("Error clearing documents:", error);
    throw error;
  }
}

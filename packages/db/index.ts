import { DB } from "sqlite";
import { Mention, SlackMessage, User } from "@/core/utils/types.ts";
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
    CREATE TABLE IF NOT EXISTS topics (
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

  db.execute(`
    CREATE TABLE IF NOT EXISTS message_topic_relations (
      message_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      PRIMARY KEY (message_id, topic_id),
      FOREIGN KEY (message_id) REFERENCES messages(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
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
      id, channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type 
    FROM messages 
    ORDER BY created_at DESC
    ${limitClause}
  `);

  return query;
}

/**
 * Get messages by their IDs and include all messages from the same threads
 */
export function getMessagesWithThreadsByIds(db: DB, messageIds: number[]): SlackMessage[] {
  if (messageIds.length === 0) {
    return [];
  }

  // First, get the initial messages
  const placeholders = messageIds.map(() => '?').join(',');
  const initialMessages = db.queryEntries<SlackMessage & { id: number }>(`
    SELECT 
      id, channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type 
    FROM messages 
    WHERE id IN (${placeholders})
  `, messageIds);

  // Collect all thread IDs from the initial messages
  const threadIds = new Set<string>();
  for (const msg of initialMessages) {
    if (msg.thread_id) {
      threadIds.add(msg.thread_id);
    }
    // Also add the message's own ts as a potential thread_id (for parent messages)
    threadIds.add(msg.ts);
  }

  if (threadIds.size === 0) {
    return initialMessages;
  }

  // Get all messages that belong to these threads
  const threadPlaceholders = Array.from(threadIds).map(() => '?').join(',');
  const threadMessages = db.queryEntries<SlackMessage & { id: number }>(`
    SELECT 
      id, channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type 
    FROM messages 
    WHERE thread_id IN (${threadPlaceholders}) OR ts IN (${threadPlaceholders})
  `, [...threadIds, ...threadIds]);

  // Combine and deduplicate messages
  const allMessages = new Map<number, SlackMessage & { id: number }>();
  
  for (const msg of [...initialMessages, ...threadMessages]) {
    allMessages.set(msg.id, msg);
  }

  // Sort by created_at and return
  return Array.from(allMessages.values()).sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * Calculate start and end dates from a list of messages
 */
export function calculateTopicDateRange(messages: SlackMessage[]): { startDate: string; endDate: string } | null {
  if (messages.length === 0) {
    return null;
  }

  // Sort messages by created_at to ensure proper ordering
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    startDate: sortedMessages[0].created_at,
    endDate: sortedMessages[sortedMessages.length - 1].created_at
  };
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
 * Insert or update topics in SQLite database
 */
export function saveTopic(
  db: DB,
  title: string,
  description?: string,
  fileName?: string,
  messageIds?: number[],
  isUpdate = false,
): number {
  const now = new Date().toISOString();
  
  // Calculate start_date and end_date from message IDs if provided
  let startDate: string | null = null;
  let endDate: string | null = null;
  
  if (messageIds && messageIds.length > 0) {
    const relatedMessages = getMessagesWithThreadsByIds(db, messageIds);
    const dateRange = calculateTopicDateRange(relatedMessages);
    if (dateRange) {
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }
  }

  if (isUpdate && fileName) {
    // Update existing topic by file_name
    const stmt = db.prepareQuery(`
      UPDATE topics SET title = ?, description = ?, start_date = ?, end_date = ?, updated_at = ? WHERE file_name = ?
    `);
    try {
      stmt.execute([title, description || null, startDate, endDate, now, fileName]);
    } finally {
      stmt.finalize();
    }

    // Get the topic ID
    const result = db.queryEntries<{ id: number }>(
      `SELECT id FROM topics WHERE file_name = ?`,
      [fileName],
    );

    return result[0].id;
  } else {
    // Check if topic already exists by file_name
    if (fileName) {
      const existing = getTopicByFileName(db, fileName);
      if (existing) {
        console.log(`Topic already exists, updating instead: ${fileName}`);
        return saveTopic(db, title, description, fileName, messageIds, true);
      }
    }

    // Insert new topic
    const stmt = db.prepareQuery(`
      INSERT INTO topics (title, description, file_name, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.execute([title, description || null, fileName || null, startDate, endDate, now, now]);
      console.log(`Saved topic: ${title}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        console.log(`Topic already exists due to race condition, updating instead: ${fileName}`);
        return saveTopic(db, title, description, fileName, messageIds, true);
      }
      throw error;
    } finally {
      stmt.finalize();
    }

    // Get the inserted topic ID
    const insertedId = db.lastInsertRowId;
    if (typeof insertedId !== "number") {
      throw new Error("Failed to get inserted topic ID");
    }
    return insertedId;
  }
}

/**
 * Get topic by file name
 */
export function getTopicByFileName(
  db: DB,
  fileName: string,
): {
  id: number;
  title: string;
  description: string | null;
  file_name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
} | null {
  const result = db.queryEntries<
    {
      id: number;
      title: string;
      description: string | null;
      file_name: string;
      start_date: string | null;
      end_date: string | null;
      created_at: string;
      updated_at: string;
    }
  >(
    `SELECT id, title, description, file_name, start_date, end_date, created_at, updated_at FROM topics WHERE file_name = ?`,
    [fileName],
  );

  return result.length > 0 ? result[0] : null;
}

/**
 * Get topic by ID
 */
export function getTopicById(
  db: DB,
  id: number,
): {
  id: number;
  title: string;
  description: string | null;
  file_name: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
} | null {
  const result = db.queryEntries<
    {
      id: number;
      title: string;
      description: string | null;
      file_name: string | null;
      start_date: string | null;
      end_date: string | null;
      created_at: string;
      updated_at: string;
    }
  >(
    `SELECT id, title, description, file_name, start_date, end_date, created_at, updated_at FROM topics WHERE id = ?`,
    [id],
  );

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all topics
 */
export function getTopics(
  db: DB,
  limit?: number,
): {
  id: number;
  title: string;
  description: string | null;
  file_name: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}[] {
  const limitClause = limit ? `LIMIT ${limit}` : "";
  const query = db.queryEntries<
    {
      id: number;
      title: string;
      description: string | null;
      file_name: string | null;
      start_date: string | null;
      end_date: string | null;
      created_at: string;
      updated_at: string;
    }
  >(`
    SELECT id, title, description, file_name, start_date, end_date, created_at, updated_at FROM topics 
    ORDER BY updated_at DESC
    ${limitClause}
  `);
  return query;
}

/**
 * Insert message-topic relations into SQLite database
 */
export function saveMessageTopicRelations(
  db: DB,
  relations: { message_id: number; topic_id: number }[],
) {
  const stmt = db.prepareQuery(`
    INSERT OR REPLACE INTO message_topic_relations (message_id, topic_id)
    VALUES (?, ?)
  `);

  try {
    for (const relation of relations) {
      stmt.execute([relation.message_id, relation.topic_id]);
    }
    console.log(
      `Saved ${relations.length} message-topic relations to database`,
    );
  } finally {
    stmt.finalize();
  }
}

/**
 * Fetch message-topic relations from the database
 */
export function getMessageTopicRelations(
  db: DB,
  messageId?: number,
  topicId?: number,
  limit?: number,
): { message_id: number; topic_id: number; topic_title?: string; topic_file_name?: string | null }[] {
  let whereClause = "";
  const params: number[] = [];

  if (messageId !== undefined) {
    whereClause = "WHERE mtr.message_id = ?";
    params.push(messageId);
  } else if (topicId !== undefined) {
    whereClause = "WHERE mtr.topic_id = ?";
    params.push(topicId);
  }

  const limitClause = limit ? `LIMIT ${limit}` : "";

  const query = db.queryEntries<
    { message_id: number; topic_id: number; topic_title: string; topic_file_name: string | null }
  >(
    `
    SELECT mtr.message_id, mtr.topic_id, t.title as topic_title, t.file_name as topic_file_name 
    FROM message_topic_relations mtr
    JOIN topics t ON mtr.topic_id = t.id
    ${whereClause}
    ORDER BY mtr.message_id DESC
    ${limitClause}
  `,
    params,
  );

  return query;
}

/**
 * Clear all topics and related message-topic relations
 */
export function clearTopics(db: DB): void {
  try {
    // Delete all message-topic relations first (due to foreign key constraints)
    db.execute("DELETE FROM message_topic_relations");

    // Delete all topics
    db.execute("DELETE FROM topics");

    console.log("Cleared all topics and related relations from database");
  } catch (error) {
    console.error("Error clearing topics:", error);
    throw error;
  }
}

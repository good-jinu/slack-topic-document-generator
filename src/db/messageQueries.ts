import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";

/**
 * Validates date range inputs
 */
export function validateDateRange(startDate: Date, endDate: Date): void {
  if (isNaN(startDate.getTime())) {
    throw new Error("Invalid start date");
  }
  if (isNaN(endDate.getTime())) {
    throw new Error("Invalid end date");
  }
  if (startDate > endDate) {
    throw new Error("Start date must be before or equal to end date");
  }
}

/**
 * Get messages within a time range
 */
export function getMessagesInTimeRange(
  db: DB,
  startDate: Date,
  endDate: Date,
): (SlackMessage & { id: number })[] {
  validateDateRange(startDate, endDate);

  const query = db.queryEntries<SlackMessage & { id: number }>(
    `
    SELECT 
      id, channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type 
    FROM messages 
    WHERE created_at >= ? AND created_at <= ?
    ORDER BY created_at ASC
  `,
    [startDate.toISOString(), endDate.toISOString()],
  );

  return query;
}

/**
 * Get messages that mention a specific user within a date range
 * Supports both user ID format (<@U123456>) and username format (@username)
 */
export function getMessagesWithUserMention(
  db: DB,
  startDate: Date,
  endDate: Date,
  userMention: string,
): (SlackMessage & { id: number })[] {
  validateDateRange(startDate, endDate);

  // Handle different mention formats:
  // 1. User ID format: <@U123456> or U123456
  // 2. Username format: @username or username
  let userIdPattern = "";
  let usernamePattern = "";

  if (userMention.startsWith("<@") && userMention.endsWith(">")) {
    // Format: <@U123456>
    userIdPattern = userMention;
    const userId = userMention.slice(2, -1); // Extract U123456
    usernamePattern = userId;
  } else if (userMention.startsWith("U")) {
    // Format: U123456
    userIdPattern = `<@${userMention}>`;
    usernamePattern = userMention;
  } else {
    // Format: @username or username
    const cleanUsername = userMention.startsWith("@")
      ? userMention.slice(1)
      : userMention;
    usernamePattern = cleanUsername;
    userIdPattern = `@${cleanUsername}`;
  }

  // Get messages that mention the user in various ways
  const query = db.queryEntries<SlackMessage & { id: number }>(
    `
    SELECT DISTINCT
      m.id, m.channel_id, m.channel_name, m.user_id, m.user_name, 
      m.text, m.ts, m.thread_id, m.permalink, m.created_at, m.mention_type 
    FROM messages m
    LEFT JOIN mentions men ON m.channel_id = men.channel_id AND m.ts = men.message_ts
    LEFT JOIN users u ON men.user_id = u.user_id
    WHERE m.created_at >= ? AND m.created_at <= ?
    AND (
      m.text LIKE ? OR 
      m.text LIKE ? OR
      u.user_name = ? OR 
      u.nickname = ? OR
      men.user_id = ?
    )
    ORDER BY m.created_at ASC
  `,
    [
      startDate.toISOString(),
      endDate.toISOString(),
      `%${userIdPattern}%`,
      `%${userIdPattern}%`,
      usernamePattern,
      usernamePattern,
      usernamePattern.startsWith("U") ? usernamePattern : null,
    ],
  );

  return query;
}

/**
 * Get all thread messages for a given parent message timestamp
 */
export function getThreadMessages(
  db: DB,
  parentTs: string,
): (SlackMessage & { id: number })[] {
  // First get the parent message (the one with ts = parentTs and no thread_id)
  // Then get all replies (messages with thread_id = parentTs)
  const query = db.queryEntries<SlackMessage & { id: number }>(
    `
    SELECT 
      id, channel_id, channel_name, user_id, user_name, text, ts, thread_id, permalink, created_at, mention_type 
    FROM messages 
    WHERE (thread_id = ? OR (ts = ? AND thread_id IS NULL))
    ORDER BY created_at ASC
  `,
    [parentTs, parentTs],
  );

  return query;
}

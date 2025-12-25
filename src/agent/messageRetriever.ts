import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";

/**
 * Get messages within a time range
 */
export function getMessagesInTimeRange(
  db: DB,
  startDate: Date,
  endDate: Date,
): (SlackMessage & { id: number })[] {
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

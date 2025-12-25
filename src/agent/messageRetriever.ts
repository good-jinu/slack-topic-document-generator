import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";
import {
  getMessagesInTimeRange,
  getMessagesWithUserMention,
  getThreadMessages,
  validateDateRange,
} from "../db/messageQueries.ts";

/**
 * Interface for message filtering options
 */
export interface MessageFilter {
  startDate: Date;
  endDate: Date;
  userMention?: string;
  includeThreads?: boolean;
}

/**
 * Get filtered messages based on comprehensive filter criteria
 */
export function getFilteredMessages(
  db: DB,
  filter: MessageFilter,
): (SlackMessage & { id: number })[] {
  validateDateRange(filter.startDate, filter.endDate);

  let messages: (SlackMessage & { id: number })[];

  // Get base messages (with or without user mention filtering)
  if (filter.userMention) {
    messages = getMessagesWithUserMention(
      db,
      filter.startDate,
      filter.endDate,
      filter.userMention,
    );
  } else {
    messages = getMessagesInTimeRange(db, filter.startDate, filter.endDate);
  }

  // Include thread messages if requested
  if (filter.includeThreads) {
    const threadMessages = new Set<string>();
    const allMessages = [...messages];

    // Collect all thread IDs and parent message timestamps
    for (const message of messages) {
      if (message.thread_id) {
        threadMessages.add(message.thread_id);
      }
      // Also check if this message itself is a parent of threads
      threadMessages.add(message.ts);
    }

    // Get all thread messages for collected thread IDs
    for (const threadId of threadMessages) {
      const threadMsgs = getThreadMessages(db, threadId);
      for (const threadMsg of threadMsgs) {
        // Only add if not already included and within date range
        if (!allMessages.some((m) => m.id === threadMsg.id)) {
          const msgDate = new Date(threadMsg.created_at);
          if (msgDate >= filter.startDate && msgDate <= filter.endDate) {
            allMessages.push(threadMsg);
          }
        }
      }
    }

    // Sort by creation date
    allMessages.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return allMessages;
  }

  return messages;
}

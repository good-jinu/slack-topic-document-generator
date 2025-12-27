import { DB } from "sqlite";
import { SlackMessage } from "@/core/utils/types.ts";
import {
  getMessagesFromUsers,
  getMessagesInTimeRange,
  getMessagesWithMultipleUserMentions,
  getThreadMessages,
  validateDateRange,
} from "@/db/messageQueries.ts";

/**
 * Interface for message filtering options
 */
export interface MessageFilter {
  startDate: Date;
  endDate: Date;
  userMentions?: string[];
  userContainings?: string[];
  includeThreads?: boolean;
}

/**
 * Interface for a thread containing a parent message and its replies
 */
export interface MessageThread {
  /** The parent/root message of the thread */
  parentMessage: SlackMessage & { id: number };
  /** Array of reply messages in chronological order */
  replies: (SlackMessage & { id: number })[];
  /** Thread identifier (same as parent message ts) */
  threadId: string;
  /** Total number of messages in this thread (parent + replies) */
  messageCount: number;
}

/**
 * Interface for grouped messages result
 */
export interface GroupedMessages {
  /** Messages that are part of threads, grouped by thread */
  threads: MessageThread[];
  /** Standalone messages that are not part of any thread */
  standaloneMessages: (SlackMessage & { id: number })[];
  /** Total number of messages across all threads and standalone messages */
  totalMessageCount: number;
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

  // Get base messages (with user mention filtering, user containing filtering, or no filtering)
  if (filter.userMentions && filter.userMentions.length > 0) {
    messages = getMessagesWithMultipleUserMentions(
      db,
      filter.startDate,
      filter.endDate,
      filter.userMentions,
    );
  } else if (filter.userContainings && filter.userContainings.length > 0) {
    messages = getMessagesFromUsers(
      db,
      filter.startDate,
      filter.endDate,
      filter.userContainings,
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
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return allMessages;
  }

  return messages;
}

/**
 * Get filtered messages grouped by threads for better LLM understanding
 */
export function getFilteredMessagesGrouped(
  db: DB,
  filter: MessageFilter,
): GroupedMessages {
  validateDateRange(filter.startDate, filter.endDate);

  let messages: (SlackMessage & { id: number })[];

  // Get base messages (with user mention filtering, user containing filtering, or no filtering)
  if (filter.userMentions && filter.userMentions.length > 0) {
    messages = getMessagesWithMultipleUserMentions(
      db,
      filter.startDate,
      filter.endDate,
      filter.userMentions,
    );
  } else if (filter.userContainings && filter.userContainings.length > 0) {
    messages = getMessagesFromUsers(
      db,
      filter.startDate,
      filter.endDate,
      filter.userContainings,
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

    messages = allMessages;
  }

  // Group messages by threads
  return groupMessagesByThreads(messages);
}

/**
 * Groups messages by threads, separating parent messages and replies
 */
function groupMessagesByThreads(
  messages: (SlackMessage & { id: number })[],
): GroupedMessages {
  const threadsMap = new Map<string, MessageThread>();
  const standaloneMessages: (SlackMessage & { id: number })[] = [];

  // Sort messages by creation date first
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // First pass: identify all thread IDs and group replies
  const threadReplies = new Map<string, (SlackMessage & { id: number })[]>();
  const parentMessages = new Map<string, SlackMessage & { id: number }>();

  for (const message of sortedMessages) {
    if (message.thread_id) {
      // This is a reply message
      if (!threadReplies.has(message.thread_id)) {
        threadReplies.set(message.thread_id, []);
      }
      threadReplies.get(message.thread_id)!.push(message);
    } else {
      // Check if this message is a parent of any thread
      const isParentOfThread = sortedMessages.some(
        (msg) => msg.thread_id === message.ts,
      );

      if (isParentOfThread) {
        parentMessages.set(message.ts, message);
      } else {
        // This is a standalone message
        standaloneMessages.push(message);
      }
    }
  }

  // Second pass: create threads
  for (const [threadId, replies] of threadReplies.entries()) {
    const parentMessage = parentMessages.get(threadId);

    if (parentMessage) {
      // Normal case: parent message exists in filtered results
      threadsMap.set(threadId, {
        parentMessage,
        replies: replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        threadId,
        messageCount: 1 + replies.length,
      });
    } else {
      // Parent message not in filtered results, create thread with first reply as "starter"
      const sortedReplies = replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const firstReply = sortedReplies[0];
      const remainingReplies = sortedReplies.slice(1);

      // Create a pseudo-parent message from the first reply
      const pseudoParent = {
        ...firstReply,
        thread_id: undefined, // Remove thread_id to make it look like a parent
      };

      threadsMap.set(threadId, {
        parentMessage: pseudoParent,
        replies: remainingReplies,
        threadId,
        messageCount: replies.length,
      });
    }
  }

  // Add any parent messages that don't have replies as standalone messages
  for (const [ts, parentMessage] of parentMessages.entries()) {
    if (!threadsMap.has(ts)) {
      standaloneMessages.push(parentMessage);
    }
  }

  const threads = Array.from(threadsMap.values());
  const totalMessageCount = threads.reduce((sum, thread) => sum + thread.messageCount, 0) +
    standaloneMessages.length;

  return {
    threads,
    standaloneMessages,
    totalMessageCount,
  };
}

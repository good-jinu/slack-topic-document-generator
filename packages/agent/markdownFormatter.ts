import { DB } from "sqlite";
import { SlackMessage } from "@/shared/utils/types.ts";
import { parseMessage } from "./messageParser.ts";
import { GroupedMessages, MessageThread } from "./messageRetriever.ts";

/**
 * Convert messages to markdown format
 */
export function messagesToMarkdown(
  messages: (SlackMessage & { id: number })[],
  db: DB,
): string {
  let markdown = "# Slack Messages\n\n";

  for (const msg of messages) {
    const parsedText = parseMessage(msg.text, db);
    const date = new Date(msg.created_at).toLocaleString();

    markdown += `## Message ID: ${msg.id}\n`;
    markdown += `**Channel:** ${msg.channel_name}\n`;
    markdown += `**User:** ${msg.user_name}\n`;
    markdown += `**Time:** ${date}\n`;
    if (msg.thread_id) {
      markdown += `**Thread:** ${msg.thread_id}\n`;
    }
    markdown += `**Content:** ${parsedText}\n\n`;
    markdown += "---\n\n";
  }

  return markdown;
}

/**
 * Convert grouped messages to markdown format with thread structure preserved
 */
export function groupedMessagesToMarkdown(
  groupedMessages: GroupedMessages,
  db: DB,
): string {
  let markdown = "# Slack Messages (Grouped by Threads)\n\n";

  // Process threads first
  if (groupedMessages.threads.length > 0) {
    markdown += "## Conversation Threads\n\n";

    for (let i = 0; i < groupedMessages.threads.length; i++) {
      const thread = groupedMessages.threads[i];
      markdown += formatThread(thread, db);
    }
  }

  // Process standalone messages
  if (groupedMessages.standaloneMessages.length > 0) {
    markdown += "## Standalone Messages\n\n";

    for (const msg of groupedMessages.standaloneMessages) {
      markdown += formatMessage(msg, db, false);
    }
  }

  return markdown;
}

/**
 * Format a single thread with parent and replies
 */
function formatThread(thread: MessageThread, db: DB): string {
  let markdown = `### Thread (message id: ${thread.parentMessage.id})\n\n`;

  // Check if the "parent" message is actually a reply (pseudo-parent case)
  const isOriginalParent = !thread.parentMessage.thread_id;

  if (isOriginalParent) {
    markdown += "**🧵 Thread Starter:**\n";
  } else {
    markdown += "**🧵 Thread (original starter not in results):**\n";
  }

  markdown += formatMessage(thread.parentMessage, db, true);

  // Format replies
  if (thread.replies.length > 0) {
    markdown += "**💬 Replies:**\n\n";

    for (let i = 0; i < thread.replies.length; i++) {
      const reply = thread.replies[i];
      markdown += `**Reply:**\n`;
      markdown += formatMessage(reply, db, true);
    }
  }

  markdown += "---\n\n";
  return markdown;
}

/**
 * Format a single message
 */
function formatMessage(
  msg: SlackMessage & { id: number },
  db: DB,
  isInThread: boolean = false,
): string {
  const parsedText = parseMessage(msg.text, db);
  const date = new Date(msg.created_at).toLocaleString();

  let markdown = "";
  if (!isInThread) {
    markdown += `#### Message ID: ${msg.id}\n`;
  }

  markdown += `- **Channel:** ${msg.channel_name}\n`;
  markdown += `- **User:** ${msg.user_name}\n`;
  markdown += `- **Time:** ${date}\n`;
  if (!isInThread && msg.thread_id) {
    markdown += `- **Thread ID:** ${msg.thread_id}\n`;
  }
  markdown += `- **Content:** ${parsedText}\n\n`;

  if (!isInThread) {
    markdown += "---\n\n";
  }

  return markdown;
}

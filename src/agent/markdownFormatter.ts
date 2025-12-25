import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";
import { parseMessage } from "./messageParser.ts";

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

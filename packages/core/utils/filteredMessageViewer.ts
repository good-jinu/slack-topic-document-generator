import { initDatabase } from "@/db/index.ts";
import { getFilteredMessages, getFilteredMessagesGrouped, MessageFilter } from "@/core/agent/messageRetriever.ts";
import { groupedMessagesToMarkdown } from "@/core/agent/markdownFormatter.ts";
import { loadConfig } from "@/core/config/index.ts";
import { parseAndValidateDate, validateUserMention } from "./validation.ts";
import { SlackMessage } from "./types.ts";

/**
 * Interface for command line arguments
 */
interface FilteredMessageArgs {
  startDate: Date;
  endDate: Date;
  userMentions?: string[];
  includeThreads?: boolean;
  markdownOutput?: boolean;
}

/**
 * Parses and validates command line arguments
 */
function parseCommandArgs(args: string[]): FilteredMessageArgs {
  if (args.length < 2) {
    throw new Error("Missing required parameters");
  }

  const startDate = parseAndValidateDate(args[0], "start date");
  const endDate = parseAndValidateDate(args[1], "end date");

  // Validate date range
  if (startDate > endDate) {
    throw new Error(
      `Start date (${args[0]}) must be before or equal to end date (${args[1]})`,
    );
  }

  // Parse optional flags and user mentions
  const userMentions: string[] = [];
  let includeThreads = false;
  let markdownOutput = false;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--include-threads" || arg === "-t") {
      includeThreads = true;
    } else if (arg === "--markdown" || arg === "-m") {
      markdownOutput = true;
    } else {
      // Validate user mention format
      const validation = validateUserMention(arg);
      if (!validation.isValid) {
        throw new Error(`Invalid user mention "${arg}": ${validation.error!}`);
      }
      userMentions.push(arg.trim());
    }
  }

  return {
    startDate,
    endDate,
    userMentions: userMentions.length > 0 ? userMentions : undefined,
    includeThreads,
    markdownOutput,
  };
}

/**
 * Displays usage instructions
 */
function showUsage(): void {
  console.log(
    "Usage: deno task filteredMessage <start-date> <end-date> [options] [user-mentions...]",
  );
  console.log("");
  console.log("Parameters:");
  console.log("  start-date       Start date in YYYY-MM-DD format");
  console.log("  end-date         End date in YYYY-MM-DD format");
  console.log("");
  console.log("Options:");
  console.log("  --include-threads, -t    Include thread messages");
  console.log("  --markdown, -m           Output in markdown format (grouped by threads)");
  console.log("");
  console.log("User/Group mention formats:");
  console.log("  @username        Username with @ prefix");
  console.log("  username         Username without @ prefix");
  console.log("  <@U123456>       Slack user ID format");
  console.log("  U123456          Raw Slack user ID");
  console.log("  @groupname       Group name with @ prefix");
  console.log("  groupname        Group name without @ prefix");
  console.log("");
  console.log("Examples:");
  console.log("  deno task filteredMessage 2025-12-20 2025-12-24");
  console.log(
    "  deno task filteredMessage 2025-12-20 2025-12-24 --include-threads",
  );
  console.log(
    "  deno task filteredMessage 2025-12-20 2025-12-24 --markdown",
  );
  console.log("  deno task filteredMessage 2025-12-20 2025-12-24 @john.doe");
  console.log(
    "  deno task filteredMessage 2025-12-20 2025-12-24 -t -m @john.doe @team-leads",
  );
}

/**
 * Formats a message for display
 */
function formatMessage(message: SlackMessage): string {
  const date = new Date(message.created_at).toLocaleString();
  const user = message.user_name || message.user_id || "Unknown";
  const channel = message.channel_name || message.channel_id || "Unknown";
  const threadInfo = message.thread_id ? ` [Thread: ${message.thread_id}]` : "";

  return `[${date}] ${user} in #${channel}${threadInfo}:\n${message.text}\n`;
}

/**
 * Main filtered message viewer function
 */
async function viewFilteredMessages(
  startDate: Date,
  endDate: Date,
  userMentions?: string[],
  includeThreads = false,
  markdownOutput = false,
): Promise<void> {
  // Load configuration
  const config = await loadConfig();
  const database = initDatabase(config.database.path);

  try {
    const filter: MessageFilter = {
      startDate,
      endDate,
      userMentions,
      includeThreads,
    };

    if (!markdownOutput) {
      console.log("Retrieving filtered messages...");
      console.log(
        `Date range: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`,
      );

      if (userMentions && userMentions.length > 0) {
        console.log(`User mentions: ${userMentions.join(", ")}`);
      }

      if (includeThreads) {
        console.log("Including thread messages");
      }

      console.log("---");
    }

    if (markdownOutput) {
      // Use grouped messages for markdown output
      const groupedMessages = getFilteredMessagesGrouped(database, filter);

      if (groupedMessages.totalMessageCount === 0) {
        console.log("No messages found matching the criteria.");
        return;
      }

      const markdown = groupedMessagesToMarkdown(groupedMessages, database);
      console.log(markdown);
    } else {
      // Use flat messages for console output
      const messages = getFilteredMessages(database, filter);

      if (messages.length === 0) {
        console.log("No messages found matching the criteria.");
        return;
      }

      console.log(`Found ${messages.length} messages:\n`);

      for (const message of messages) {
        console.log(formatMessage(message));
        console.log("---");
      }

      console.log(`\nTotal: ${messages.length} messages`);
    }
  } catch (error) {
    console.error("Error retrieving messages:", error);
    throw error;
  } finally {
    database.close();
  }
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = Deno.args;

  try {
    const { startDate, endDate, userMentions, includeThreads, markdownOutput } = parseCommandArgs(args);

    // Set end date to end of day for inclusive range
    endDate.setHours(23, 59, 59, 999);

    await viewFilteredMessages(
      startDate,
      endDate,
      userMentions,
      includeThreads,
      markdownOutput,
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Missing required parameters") {
        console.error(`Error: ${error.message}`);
        console.error("");
        showUsage();
      } else {
        console.error(`Error: ${error.message}`);
      }
    } else {
      console.error("An unexpected error occurred:", error);
    }
    Deno.exit(1);
  }
}

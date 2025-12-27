import { SlackAPI } from "deno-slack-api/mod.ts";
import { load } from "std/dotenv";
import { initDatabase, saveMentions, saveMessages, saveUsers } from "@monorepo/db/index.ts";
import { Mention, SlackMessage } from "@monorepo/core/utils/types.ts";
import { getAllUserGroups, getUserGroups } from "./userGroups.ts";
import { fetchChannelMessages } from "./messagesFetcher.ts";
import { fetchUsers } from "./usersFetcher.ts";

// Load .env file
await load({ export: true, allowEmptyValues: true });

/**
 * Parse command line arguments for date range
 */
function parseArgs(): { startDate?: Date; endDate?: Date } {
  const args = Deno.args;

  if (args.length === 0) {
    return {}; // No date range specified, crawl all
  }

  if (args.length !== 2) {
    console.error("Error: Invalid number of parameters");
    console.error("");
    console.error("Usage: deno task crawl [start-date] [end-date]");
    console.error("");
    console.error("Parameters:");
    console.error("  start-date    Start date in YYYY-MM-DD format (optional)");
    console.error("  end-date      End date in YYYY-MM-DD format (optional)");
    console.error("");
    console.error("Examples:");
    console.error("  deno task crawl                    # Crawl all messages");
    console.error(
      "  deno task crawl 2025-12-01 2025-12-24  # Crawl date range",
    );
    Deno.exit(1);
  }

  const [startDateStr, endDateStr] = args;

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDateStr)) {
    console.error(`Error: Invalid start date format: "${startDateStr}"`);
    console.error("Expected format: YYYY-MM-DD");
    Deno.exit(1);
  }

  if (!dateRegex.test(endDateStr)) {
    console.error(`Error: Invalid end date format: "${endDateStr}"`);
    console.error("Expected format: YYYY-MM-DD");
    Deno.exit(1);
  }

  try {
    const startDate = new Date(startDateStr + "T00:00:00.000Z");
    const endDate = new Date(endDateStr + "T23:59:59.999Z");

    if (isNaN(startDate.getTime())) {
      throw new Error(`Invalid start date: "${startDateStr}"`);
    }

    if (isNaN(endDate.getTime())) {
      throw new Error(`Invalid end date: "${endDateStr}"`);
    }

    if (startDate > endDate) {
      throw new Error(
        `Start date (${startDateStr}) must be before or equal to end date (${endDateStr})`,
      );
    }

    console.log(
      `Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );
    return { startDate, endDate };
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    console.error("Please use YYYY-MM-DD format for dates");
    Deno.exit(1);
  }
}

/**
 * Main crawler function
 */
async function crawlMentions() {
  // Parse command line arguments
  const { startDate, endDate } = parseArgs();

  const token = Deno.env.get("SLACK_USER_TOKEN");
  const channelsEnv = Deno.env.get("SLACK_CHANNELS");

  if (!token) {
    console.error("Error: SLACK_USER_TOKEN environment variable is not set.");
    console.log(
      "Please create a .env file with SLACK_USER_TOKEN=xoxp-your-token",
    );
    return;
  }

  if (!channelsEnv) {
    console.error("Error: SLACK_CHANNELS environment variable is not set.");
    console.log(
      "Please add SLACK_CHANNELS=C1234567890,C0987654321 to your .env file",
    );
    return;
  }

  const channelIds = channelsEnv.split(",").map((id) => id.trim());
  console.log(`Channels to crawl: ${channelIds.join(", ")}`);

  const client = SlackAPI(token);

  console.log("Progress: Authenticating with Slack API...");

  // Get your own User ID
  const authResponse = await client.auth.test();
  if (!authResponse.ok) {
    console.error("Error calling auth.test:", authResponse.error);
    return;
  }

  const myId = authResponse.user_id;
  console.log(
    `Searching for mentions of: ${myId} (User: ${authResponse.user})\n`,
  );

  // Get user groups
  console.log("Progress: Fetching user groups...");
  const userGroupIds = await getUserGroups(client, myId);
  if (userGroupIds.length > 0) {
    console.log(`Found ${userGroupIds.length} user groups\n`);
  } else {
    console.log("No user groups found or not a member of any groups\n");
  }

  // Fetch all user groups for storage
  console.log("Progress: Fetching all user groups for storage...");
  const allGroups = await getAllUserGroups(client);
  console.log(`Found ${allGroups.length} total groups\n`);

  // Initialize database
  console.log("Progress: Initializing database...");
  const db = initDatabase();

  try {
    let allMessages: SlackMessage[] = [];
    let allMentions: Mention[] = [];
    const userIds = new Set<string>();

    // Fetch messages from each channel
    console.log("Progress: Starting message crawling...");
    for (const channelId of channelIds) {
      console.log(`Progress: Crawling channel ${channelId}...`);
      const { messages, mentions } = await fetchChannelMessages(
        client,
        channelId,
        myId,
        userGroupIds,
        startDate,
        endDate,
      );
      allMessages = [...allMessages, ...messages];
      allMentions = [...allMentions, ...mentions];

      for (const msg of messages) {
        if (msg.user_id) userIds.add(msg.user_id);
      }
      for (const mention of mentions) {
        userIds.add(mention.user_id);
      }

      console.log(`Channel ${channelId} summary:`);
      console.log(`  - Total messages: ${messages.length}`);
      console.log(`  - Total mentions: ${mentions.length}\n`);
    }

    if (allMessages.length === 0) {
      console.log("No messages found in specified channels.");
      return;
    }

    // Fetch user details
    console.log("Progress: Fetching user details...");
    const users = await fetchUsers(client, userIds);

    // Convert groups to user format for merged table
    const groupsAsUsers = allGroups.map((group) => ({
      user_id: group.group_id,
      user_name: group.group_name,
      nickname: group.handle || group.group_name,
      user_type: "group" as const,
    }));

    // Combine users and groups
    const allUsersAndGroups = [
      ...users.map((user) => ({ ...user, user_type: "user" as const })),
      ...groupsAsUsers,
    ];

    // Map user names back to messages for convenience (optional, since we have users table)
    const userMap = new Map(users.map((u) => [u.user_id, u.user_name]));
    for (const msg of allMessages) {
      msg.user_name = userMap.get(msg.user_id) || "";
    }

    // Save to database
    console.log("Progress: Saving data to database...");
    saveMessages(db, allMessages);
    saveUsers(db, allUsersAndGroups);
    saveMentions(db, allMentions);

    console.log(`\n=== Crawling Summary ===`);
    console.log(`Total messages saved: ${allMessages.length}`);
    console.log(`Total users saved: ${users.length}`);
    console.log(`Total groups saved: ${allGroups.length}`);
    console.log(`Total mentions saved: ${allMentions.length}`);
    console.log("Progress: Crawling completed successfully!");
  } catch (error) {
    console.error("An error occurred during crawling:", error);
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  crawlMentions();
}

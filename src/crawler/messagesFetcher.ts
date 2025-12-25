import { type SlackAPIClient } from "deno-slack-api/types.ts";
import { Mention, SlackMessage } from "../utils/types.ts";
import { dateToSlackTs, extractMentions, slackTsToISODate } from "./utils.ts";

/**
 * Fetch all messages from a specific channel
 */
export async function fetchChannelMessages(
  client: SlackAPIClient,
  channelId: string,
  myId: string,
  userGroupIds: string[],
  startDate?: Date,
  endDate?: Date,
): Promise<{ messages: SlackMessage[]; mentions: Mention[] }> {
  const messages: SlackMessage[] = [];
  const mentions: Mention[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  console.log(`Fetching messages from channel: ${channelId}`);

  if (startDate && endDate) {
    console.log(
      `  - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );
  }

  // Get channel info once
  const channelInfoResponse = await client.conversations.info({
    channel: channelId,
  });
  const channelName = channelInfoResponse.channel?.name || "";

  // Convert dates to Slack timestamps for API filtering
  const oldest = startDate ? dateToSlackTs(startDate) : undefined;
  const latest = endDate ? dateToSlackTs(endDate) : undefined;

  while (hasMore) {
    const requestParams: any = {
      channel: channelId,
      limit: 200,
      cursor: cursor,
    };

    // Add date range parameters if specified
    if (oldest) requestParams.oldest = oldest;
    if (latest) requestParams.latest = latest;

    const response = await client.conversations.history(requestParams);

    if (!response.ok) {
      console.error(`Error fetching channel history:`, response.error);
      break;
    }

    const channelMessages = response.messages || [];

    for (const msg of channelMessages) {
      if (!msg.text) continue;

      let mentionType: string | null = null;

      // Check for user mention
      if (msg.text.includes(`<@${myId}>`)) {
        mentionType = "user";
      }

      // Check for group mentions
      if (!mentionType) {
        for (const groupId of userGroupIds) {
          if (msg.text.includes(`<!subteam^${groupId}`)) {
            mentionType = "group";
            break;
          }
        }
      }

      // Extract all mentions
      const mentionedUserIds = extractMentions(msg.text);
      for (const userId of mentionedUserIds) {
        mentions.push({
          channel_id: channelId,
          message_ts: msg.ts,
          user_id: userId,
        });
      }

      messages.push({
        channel_id: channelId,
        channel_name: channelName,
        user_id: msg.user || "",
        user_name: "", // Will be updated later or handled via users table
        text: msg.text || "",
        ts: msg.ts,
        thread_id: msg.thread_ts,
        permalink: "", // We can skip permalink for all messages to save API calls, or fetch on demand
        created_at: slackTsToISODate(msg.ts),
        mention_type: mentionType,
      });
    }

    cursor = response.response_metadata?.next_cursor;
    hasMore = !!cursor;

    console.log(
      `- Processed batch, found ${messages.length} total messages so far`,
    );

    // Rate limiting for next batch
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { messages, mentions };
}

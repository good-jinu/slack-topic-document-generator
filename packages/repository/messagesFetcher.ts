import { type SlackAPIClient } from "deno-slack-api/types.ts";
import { Mention, SlackMessage } from "@topicgen/core/utils/types.ts";
import { dateToSlackTs, extractGroupMentions, extractMentions, slackTsToISODate } from "./utils.ts";

/**
 * Fetch thread replies for a specific parent message
 */
async function fetchThreadReplies(
  client: SlackAPIClient,
  channelId: string,
  channelName: string,
  parentTs: string,
  myId: string,
  userGroupIds: string[],
): Promise<{ messages: SlackMessage[]; mentions: Mention[] }> {
  const messages: SlackMessage[] = [];
  const mentions: Mention[] = [];

  try {
    const response = await client.conversations.replies({
      channel: channelId,
      ts: parentTs,
    });

    if (!response.ok) {
      console.error(
        `Error fetching thread replies for ${parentTs}:`,
        response.error,
      );
      return { messages, mentions };
    }

    const threadMessages = response.messages || [];

    // Skip the first message (parent) since we already have it
    for (let i = 1; i < threadMessages.length; i++) {
      const msg = threadMessages[i];
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

      // Extract all user mentions
      const mentionedUserIds = extractMentions(msg.text);
      for (const userId of mentionedUserIds) {
        mentions.push({
          channel_id: channelId,
          message_ts: msg.ts,
          user_id: userId,
          mention_type: "user",
        });
      }

      // Extract all group mentions
      const mentionedGroupIds = extractGroupMentions(msg.text);
      for (const groupId of mentionedGroupIds) {
        mentions.push({
          channel_id: channelId,
          message_ts: msg.ts,
          user_id: groupId,
          mention_type: "group",
        });
      }

      messages.push({
        channel_id: channelId,
        channel_name: channelName,
        user_id: msg.user || "",
        user_name: "", // Will be updated later or handled via users table
        text: msg.text || "",
        ts: msg.ts,
        thread_id: msg.thread_ts || parentTs, // Use parent timestamp as thread_id
        permalink: "", // We can skip permalink for all messages to save API calls, or fetch on demand
        created_at: slackTsToISODate(msg.ts),
        mention_type: mentionType,
      });
    }
  } catch (error) {
    console.error(`Error fetching thread replies for ${parentTs}:`, error);
  }

  return { messages, mentions };
}

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
    const requestParams: {
      channel: string;
      limit: number;
      cursor?: string;
      oldest?: string;
      latest?: string;
    } = {
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

      // Extract all user mentions
      const mentionedUserIds = extractMentions(msg.text);
      for (const userId of mentionedUserIds) {
        mentions.push({
          channel_id: channelId,
          message_ts: msg.ts,
          user_id: userId,
          mention_type: "user",
        });
      }

      // Extract all group mentions
      const mentionedGroupIds = extractGroupMentions(msg.text);
      for (const groupId of mentionedGroupIds) {
        mentions.push({
          channel_id: channelId,
          message_ts: msg.ts,
          user_id: groupId,
          mention_type: "group",
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

      // If this message has replies, fetch them
      if (msg.reply_count && msg.reply_count > 0) {
        console.log(
          `  - Fetching ${msg.reply_count} thread replies for message ${msg.ts}`,
        );
        const threadReplies = await fetchThreadReplies(
          client,
          channelId,
          channelName,
          msg.ts,
          myId,
          userGroupIds,
        );

        // Add thread replies to messages and mentions
        messages.push(...threadReplies.messages);
        mentions.push(...threadReplies.mentions);

        // Rate limiting after thread fetch
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
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

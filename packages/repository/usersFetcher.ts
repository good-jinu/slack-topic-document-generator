import { type SlackAPIClient } from "deno-slack-api/types.ts";
import { User } from "@monorepo/core/utils/types.ts";

/**
 * Fetch user details for a set of user IDs
 */
export async function fetchUsers(
  client: SlackAPIClient,
  userIds: Set<string>,
): Promise<User[]> {
  console.log(`Fetching details for ${userIds.size} users...`);
  const users: User[] = [];

  for (const userId of userIds) {
    try {
      const response = await client.users.info({ user: userId });
      if (response.ok && response.user) {
        users.push({
          user_id: userId,
          user_name: response.user.real_name || response.user.name || "",
          nickname: response.user.profile?.display_name || "",
        });
      }
      // Small delay to avoid rate limit
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching user info for ${userId}:`, error);
    }
  }

  return users;
}

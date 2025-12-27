import { type SlackAPIClient } from "deno-slack-api/types.ts";
import { Group } from "@/core/utils/types.ts";

/**
 * Get user groups that the user belongs to
 */
export async function getUserGroups(
  client: SlackAPIClient,
  userId: string,
): Promise<string[]> {
  try {
    const response = await client.usergroups.list({
      include_users: true,
    });

    if (!response.ok) {
      console.error("Error fetching user groups:", response.error);
      return [];
    }

    const userGroups: string[] = [];
    for (const group of response.usergroups || []) {
      if (group.users && group.users.includes(userId)) {
        userGroups.push(group.id);
        console.log(`Found user group: ${group.name} (${group.id})`);
      }
    }

    return userGroups;
  } catch (error) {
    console.error("Error in getUserGroups:", error);
    return [];
  }
}

/**
 * Get all user groups with their details for storage
 */
export async function getAllUserGroups(
  client: SlackAPIClient,
): Promise<Group[]> {
  try {
    const response = await client.usergroups.list({
      include_users: true,
    });

    if (!response.ok) {
      console.error("Error fetching all user groups:", response.error);
      return [];
    }

    const groups: Group[] = [];
    for (const group of response.usergroups || []) {
      groups.push({
        group_id: group.id,
        group_name: group.name || "",
        handle: group.handle || "",
      });
    }

    console.log(`Found ${groups.length} total user groups`);
    return groups;
  } catch (error) {
    console.error("Error in getAllUserGroups:", error);
    return [];
  }
}

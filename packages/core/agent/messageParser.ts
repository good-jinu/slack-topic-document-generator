import { DB } from "sqlite";
import { getGroupName, getUserName } from "@monorepo/db/index.ts";

/**
 * Parse a raw Slack message text, replacing user mentions like "<@U09CRTF2ELU>"
 * with a readable form "@nickname" and group mentions like "<!subteam^S123456>"
 * with "@groupname". If the user/group is not found in the respective table,
 * placeholder values are used.
 *
 * @param raw The raw message text from Slack.
 * @param db  An opened SQLite DB instance (the same one used elsewhere).
 * @returns   The parsed, human‑readable message.
 */
export function parseMessage(raw: string, db: DB): string {
  // Replace user mentions: <@U09CRTF2ELU> -> @nickname
  const userMentionRegex = /<@([A-Z0-9]+)>/g;
  let parsed = raw.replace(userMentionRegex, (_, userId) => {
    const name = getUserName(db, userId);
    return name ? `@${name}` : "@Dummy";
  });

  // Replace group mentions: <!subteam^S123456|@groupname> or <!subteam^S123456>
  const groupMentionRegex = /<!subteam\^([A-Z0-9]+)(?:\|@?([^>]+))?>/g;
  parsed = parsed.replace(groupMentionRegex, (_, groupId, fallbackName) => {
    const name = getGroupName(db, groupId);
    if (name) {
      return `@${name}`;
    }
    // Use fallback name if provided, otherwise use placeholder
    return fallbackName ? `@${fallbackName}` : "@UnknownGroup";
  });

  return parsed;
}

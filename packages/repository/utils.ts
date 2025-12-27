/**
 * Convert Slack timestamp to ISO date string
 */
export function slackTsToISODate(ts: string): string {
  const timestamp = parseFloat(ts) * 1000;
  return new Date(timestamp).toISOString();
}

/**
 * Convert Date to Slack timestamp
 */
export function dateToSlackTs(date: Date): string {
  return (date.getTime() / 1000).toString();
}

/**
 * Extract user IDs mentioned in text
 */
export function extractMentions(text: string): string[] {
  const userMentionRegex = /<@([A-Z0-9]+)>/g;
  const matches = text.matchAll(userMentionRegex);
  return Array.from(matches, (match) => match[1]);
}

/**
 * Extract group IDs mentioned in text
 */
export function extractGroupMentions(text: string): string[] {
  const groupMentionRegex = /<!subteam\^([A-Z0-9]+)/g;
  const matches = text.matchAll(groupMentionRegex);
  return Array.from(matches, (match) => match[1]);
}

/**
 * Zod schemas for structured AI responses
 */

import { z } from "zod";

/**
 * Schema for a single topic identified from messages
 */
export const TopicSchema = z.object({
  title: z.string().describe("A clear, concise title for the topic"),
  description: z.string().describe(
    "A brief description of what was discussed in this topic",
  ),
  message_ids: z.array(z.number()).describe(
    "Array of message IDs that relate to this topic",
  ),
});

/**
 * Schema for the complete topics result
 */
export const TopicsResultSchema = z.object({
  topics: z.array(TopicSchema).describe(
    "Array of identified topics from the messages",
  ),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type Topic = z.infer<typeof TopicSchema>;
export type TopicsResult = z.infer<typeof TopicsResultSchema>;

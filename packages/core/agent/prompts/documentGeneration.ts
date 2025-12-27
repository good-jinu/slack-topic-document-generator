/**
 * Prompt templates for document content generation
 */

import { Topic } from "../schemas.ts";

/**
 * Create a new document from scratch based on topic and messages
 */
export function createNewDocumentPrompt(
  topic: Topic,
  messagesText: string,
): string {
  return `
Create a comprehensive document based on the following Slack messages discussion.

Topic: ${topic.title}
Description: ${topic.description}

Related messages:
${messagesText}

Please create a well-structured markdown document that:
1. Summarizes the key points discussed
2. Organizes information logically
3. Includes relevant details and decisions made
4. Uses proper markdown formatting
5. Starts with a clear title using # ${topic.title}

Make it professional and easy to understand for someone who wasn't part of the original conversation.
`;
}

/**
 * Update an existing document with new information from messages
 */
export function createUpdateDocumentPrompt(
  topic: Topic,
  messagesText: string,
  existingContent: string,
): string {
  return `
Update the following document with new information from recent Slack messages.
Add the new context while maintaining the existing structure and avoiding duplication.

Existing document:
${existingContent}

New messages to incorporate:
${messagesText}

Topic: ${topic.title}
Description: ${topic.description}

Please update the document to include the new information while maintaining a coherent structure.
`;
}

/**
 * Helper function to format messages for document generation
 */
export function formatMessagesForDocument(
  messages: Array<{
    id: number;
    user_name: string;
    channel_name: string;
    created_at: string;
    text: string;
  }>,
  parseMessageFn: (text: string) => string,
): string {
  return messages.map((msg) => {
    const parsedText = parseMessageFn(msg.text);
    const date = new Date(msg.created_at).toLocaleString();
    return `[${date}] ${msg.user_name} in ${msg.channel_name}: ${parsedText}`;
  }).join("\n");
}

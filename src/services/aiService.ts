import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";
import { parseMessage } from "../agent/messageParser.ts";
import { Logger } from "../utils/logger.ts";
import { AppConfig } from "../config/index.ts";
import { createLLMProvider, LLMProvider } from "../agent/llm/index.ts";
import { Topic, TopicsResult, TopicsResultSchema } from "../agent/schemas.ts";

// Export types from schemas
export type { Topic, TopicsResult } from "../agent/schemas.ts";

export class AIService {
  private llmProvider: LLMProvider;

  constructor(config: AppConfig) {
    this.llmProvider = createLLMProvider(config);
  }

  /**
   * Generate topics using LLM provider with Zod schema validation
   */
  async generateTopics(messagesMarkdown: string): Promise<TopicsResult> {
    Logger.info("Starting topic generation with AI");

    const prompt = `
Analyze the following Slack messages and identify distinct topics that were discussed. 
For each topic, provide:
1. A clear, concise title
2. A brief description of what was discussed
3. The message IDs that relate to this topic (extract from "Message ID: X" lines)

Make sure each topic has at least one message_id associated with it.
Group related messages under the same topic when they discuss similar subjects.

Messages to analyze:
${messagesMarkdown}
`;

    Logger.debug("Sending topic generation request to AI");
    const result = await this.llmProvider.generateStructuredResponse(
      prompt,
      TopicsResultSchema,
    );
    Logger.info(`Successfully generated ${result.topics.length} topics`);
    return result;
  }

  /**
   * Generate document content using LLM provider
   */
  async generateDocumentContent(
    topic: Topic,
    relatedMessages: (SlackMessage & { id: number })[],
    db: DB,
    isUpdate = false,
    existingContent = "",
  ): Promise<string> {
    Logger.info(`Generating document content for topic: ${topic.title}`, {
      messageCount: relatedMessages.length,
      isUpdate,
    });

    const messagesText = relatedMessages.map((msg) => {
      const parsedText = parseMessage(msg.text, db);
      const date = new Date(msg.created_at).toLocaleString();
      return `[${date}] ${msg.user_name} in ${msg.channel_name}: ${parsedText}`;
    }).join("\n");

    const prompt = isUpdate
      ? `
Update the following document with new information from recent Slack messages.
Add the new context while maintaining the existing structure and avoiding duplication.

Existing document:
${existingContent}

New messages to incorporate:
${messagesText}

Topic: ${topic.title}
Description: ${topic.description}

Please update the document to include the new information while maintaining a coherent structure.
`
      : `
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

    Logger.debug("Sending document generation request to AI");
    const content = await this.llmProvider.generateContent(prompt);
    Logger.info(
      `Successfully generated document content for: ${topic.title}`,
    );
    return content;
  }
}

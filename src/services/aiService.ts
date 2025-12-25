import { GoogleGenerativeAI } from "@google/generative-ai";
import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";
import { parseMessage } from "../agent/messageParser.ts";
import { Logger } from "../utils/logger.ts";
import { RetryOptions, withRetry } from "../utils/retry.ts";
import { AppConfig } from "../config/index.ts";

export interface Topic {
  title: string;
  description: string;
  message_ids: number[];
}

export interface TopicsResult {
  topics: Topic[];
}

export class AIService {
  private genAI: GoogleGenerativeAI;
  private config: AppConfig;
  private retryOptions: RetryOptions;

  constructor(config: AppConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.ai.apiKey);
    this.retryOptions = {
      maxRetries: config.ai.maxRetries,
      delay: config.ai.rateLimitDelay,
      backoffMultiplier: 1.5,
      maxDelay: 60000,
    };
  }

  /**
   * Generate topics using Google AI with retry logic
   */
  async generateTopics(messagesMarkdown: string): Promise<TopicsResult> {
    Logger.info("Starting topic generation with AI");

    return await withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.config.ai.model,
      });

      const prompt = `
Analyze the following Slack messages and identify distinct topics that were discussed. 
For each topic, provide:
1. A clear, concise title
2. A brief description of what was discussed
3. The message IDs that relate to this topic (extract from "Message ID: X" lines)

Return the result as a JSON object with this structure:
{
  "topics": [
    {
      "title": "Topic Title",
      "description": "Brief description of the topic",
      "message_ids": [1, 2, 3]
    }
  ]
}

Make sure each topic has at least one message_id associated with it.
Group related messages under the same topic when they discuss similar subjects.

Messages to analyze:
${messagesMarkdown}
`;

      Logger.debug("Sending topic generation request to AI");
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      Logger.debug("Received AI response for topic generation");

      try {
        // Clean the response to extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in AI response");
        }

        const parsed = JSON.parse(jsonMatch[0]) as TopicsResult;
        Logger.info(`Successfully generated ${parsed.topics.length} topics`);
        return parsed;
      } catch (error) {
        Logger.error(
          "Error parsing AI response for topics",
          error instanceof Error ? error : undefined,
        );
        Logger.debug("Raw AI response", { response: text });
        throw error;
      }
    }, this.retryOptions);
  }

  /**
   * Generate document content using Google AI with retry logic
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

    return await withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.config.ai.model,
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
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      Logger.info(
        `Successfully generated document content for: ${topic.title}`,
      );
      return content;
    }, this.retryOptions);
  }
}

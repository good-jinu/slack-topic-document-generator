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
   * Generate topics using LLM provider with JSON parsing
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

Return the result as a JSON object with the following structure:

{
  "topics": [
    {
      "title": "API 성능 최적화",
      "description": "데이터베이스 쿼리 최적화와 캐싱 전략에 대한 논의",
      "message_ids": [123, 124, 127]
    },
    {
      "title": "새로운 기능 요구사항",
      "description": "사용자 대시보드 개선과 알림 시스템 추가에 대한 요청",
      "message_ids": [125, 126, 128]
    }
  ]
}

Messages to analyze:
${messagesMarkdown}

Please respond with only the JSON object, no additional text.
`;

    Logger.debug("Sending topic generation request to AI");
    const content = await this.llmProvider.generateContent(prompt);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const parsedResult = JSON.parse(jsonString);

      // Validate the parsed result against the schema
      const result = TopicsResultSchema.parse(parsedResult);
      Logger.info(`Successfully generated ${result.topics.length} topics`);
      return result;
    } catch (error) {
      Logger.error("Failed to parse AI response as JSON", { error, content });
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
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

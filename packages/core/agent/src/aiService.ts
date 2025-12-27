import { DB } from "sqlite";
import { SlackMessage } from "@topicgen/core/utils/types.ts";
import { parseMessage } from "@topicgen/core/agent/messageParser.ts";
import { Logger } from "@topicgen/core/utils/logger.ts";
import { AppConfig } from "@topicgen/core/config/index.ts";
import { createLLMProvider, LLMProvider } from "@topicgen/core/agent/llm/index.ts";
import { Topic, TopicsResult, TopicsResultSchema } from "@topicgen/core/agent/schemas.ts";
import { getTopics } from "@topicgen/db/index.ts";
import {
  createNewDocumentPrompt,
  createTopicAnalysisPrompt,
  createTopicFormattingAndMatchingPrompt,
  createUpdateDocumentPrompt,
  formatMessagesForDocument,
} from "@topicgen/core/agent/prompts/index.ts";

// Export types from schemas
export type { Topic, TopicsResult } from "@topicgen/core/agent/schemas.ts";

export class AIService {
  private llmProvider: LLMProvider;

  constructor(config: AppConfig) {
    this.llmProvider = createLLMProvider(config);
  }

  /**
   * Generate topics using LLM provider with two-step approach
   */
  async generateTopics(messagesMarkdown: string, db: DB): Promise<TopicsResult> {
    Logger.info("Starting topic generation with AI (two-step approach)");

    // Step 1: Think about how to distinguish topics
    const thinkingPrompt = createTopicAnalysisPrompt(messagesMarkdown);

    Logger.debug("Step 1: Sending thinking request to AI");
    const thinkingContent = await this.llmProvider.generateContent(thinkingPrompt);
    Logger.debug("Step 1: Received AI thinking response");

    // Get existing topics from database for step 2
    const existingTopics = getTopics(db);
    const existingTopicsText = existingTopics.map((topic) =>
      `ID: ${topic.id}, Title: "${topic.title}", Description: "${topic.description || "No description"}"`
    ).join("\n");

    // Step 2: Format the analysis into JSON and check for similar existing topics
    const formatAndMatchPrompt = createTopicFormattingAndMatchingPrompt(
      thinkingContent,
      messagesMarkdown,
      existingTopicsText,
    );

    Logger.debug("Step 2: Sending formatting and matching request to AI");
    const content = await this.llmProvider.generateContent(formatAndMatchPrompt);
    Logger.debug("Step 2: Received AI formatting and matching response");

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const parsedResult = JSON.parse(jsonString);

      // Validate the parsed result against the schema
      const result = TopicsResultSchema.parse(parsedResult);
      Logger.info(`Successfully generated ${result.topics.length} topics using two-step approach`);
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

    const messagesText = formatMessagesForDocument(
      relatedMessages,
      (text: string) => parseMessage(text, db),
    );

    const prompt = isUpdate ? createUpdateDocumentPrompt(topic, messagesText, existingContent) : createNewDocumentPrompt(topic, messagesText);

    Logger.debug("Sending document generation request to AI");
    const content = await this.llmProvider.generateContent(prompt);
    Logger.info(
      `Successfully generated document content for: ${topic.title}`,
    );
    return content;
  }
}

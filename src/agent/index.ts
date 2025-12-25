import { DB } from "sqlite";
import { initDatabase } from "../db/index.ts";
import { messagesToMarkdown } from "./markdownFormatter.ts";
import { getFilteredMessages, MessageFilter } from "./messageRetriever.ts";
import { AppConfig, loadConfig, validateConfig } from "../config/index.ts";
import { Logger } from "../utils/logger.ts";
import {
  parseAndValidateDate,
  validateUserMention,
} from "../utils/validation.ts";
import { AIService } from "../services/aiService.ts";
import { DocumentService } from "../services/documentService.ts";

/**
 * Interface for command line arguments
 */
interface GenerateCommandArgs {
  startDate: Date;
  endDate: Date;
  userMention?: string;
}

/**
 * Validates date format and returns Date object
 */
export function parseDate(dateStr: string, paramName: string): Date {
  return parseAndValidateDate(dateStr, paramName);
}

/**
 * Parses and validates command line arguments
 */
export function parseCommandArgs(args: string[]): GenerateCommandArgs {
  if (args.length < 2) {
    throw new Error("Missing required parameters");
  }

  if (args.length > 3) {
    throw new Error("Too many parameters provided");
  }

  const startDate = parseDate(args[0], "start date");
  const endDate = parseDate(args[1], "end date");

  // Validate date range
  if (startDate > endDate) {
    throw new Error(
      `Start date (${args[0]}) must be before or equal to end date (${
        args[1]
      })`,
    );
  }

  const userMention = args.length === 3 ? args[2] : undefined;

  // Validate user mention format if provided
  if (userMention !== undefined) {
    const validation = validateUserMention(userMention);
    if (!validation.isValid) {
      throw new Error(validation.error!);
    }
  }

  return {
    startDate,
    endDate,
    userMention: userMention?.trim(),
  };
}

/**
 * Displays usage instructions
 */
function showUsage(): void {
  console.log(
    "Usage: deno task generate <start-date> <end-date> [user-mention]",
  );
  console.log("");
  console.log("Parameters:");
  console.log("  start-date    Start date in YYYY-MM-DD format");
  console.log("  end-date      End date in YYYY-MM-DD format");
  console.log("  user-mention  Optional. User to filter mentions for");
  console.log("");
  console.log("User mention formats:");
  console.log("  @username     Username with @ prefix");
  console.log("  username      Username without @ prefix");
  console.log("  <@U123456>    Slack user ID format");
  console.log("  U123456       Raw Slack user ID");
  console.log("");
  console.log("Examples:");
  console.log("  deno task generate 2025-12-20 2025-12-24");
  console.log("  deno task generate 2025-12-20 2025-12-24 @john.doe");
  console.log("  deno task generate 2025-12-20 2025-12-24 <@U123456789>");
}

/**
 * Main document generation function
 */
export async function generateDocuments(
  startDate: Date,
  endDate: Date,
  userMention?: string,
  db?: DB,
  config?: AppConfig,
): Promise<void> {
  // Load configuration
  const appConfig = config || await loadConfig();
  validateConfig(appConfig);

  // Configure logging
  Logger.configure(appConfig.logging.level, appConfig.logging.enableConsole);
  Logger.info("Starting document generation process");

  // Initialize services
  const aiService = new AIService(appConfig);
  const documentService = new DocumentService(appConfig);
  const database = db || initDatabase(appConfig.database.path);

  try {
    const dateRangeStr = userMention
      ? `${startDate.toISOString()} to ${endDate.toISOString()} (filtering for user: ${userMention})`
      : `${startDate.toISOString()} to ${endDate.toISOString()}`;

    Logger.info(`Generating documents for messages from ${dateRangeStr}`);

    // Step 1: Get messages in time range with optional user mention filtering
    const filter: MessageFilter = {
      startDate,
      endDate,
      userMention,
      includeThreads: true,
    };

    Logger.info("Retrieving messages from database");
    const messages = getFilteredMessages(database, filter);

    const filterDescription = userMention
      ? `messages mentioning "${userMention}" in the specified time range`
      : `messages in the specified time range`;

    Logger.info(`Found ${messages.length} ${filterDescription}`);

    if (messages.length === 0) {
      const noResultsMessage = userMention
        ? `No messages found mentioning "${userMention}" in the specified time range`
        : "No messages found in the specified time range";
      Logger.warn(noResultsMessage);
      return;
    }

    // Step 2: Convert messages to markdown
    Logger.info("Converting messages to markdown format");
    const messagesMarkdown = messagesToMarkdown(messages, database);

    // Step 3: Generate topics using AI
    Logger.info("Analyzing messages to identify topics using AI");
    const topicsResult = await aiService.generateTopics(messagesMarkdown);
    Logger.info(`Identified ${topicsResult.topics.length} topics`);

    // Step 4: Generate documents for each topic
    for (const topic of topicsResult.topics) {
      Logger.info(`Processing topic: ${topic.title}`);

      // Get related messages
      const relatedMessages = messages.filter((msg) =>
        topic.message_ids.includes(msg.id)
      );

      if (relatedMessages.length === 0) {
        Logger.warn(`No related messages found for topic: ${topic.title}`);
        continue;
      }

      // Check for similar existing document
      const existingDoc = await documentService.findSimilarDocument(
        topic.title,
        database,
      );
      let content: string;

      if (existingDoc) {
        Logger.info(`Updating existing document: ${existingDoc.name}`);
        const existingContent = await documentService.readDocument(
          existingDoc.name,
        );
        content = await aiService.generateDocumentContent(
          topic,
          relatedMessages,
          database,
          true,
          existingContent,
        );
      } else {
        Logger.info(`Creating new document for topic: ${topic.title}`);
        content = await aiService.generateDocumentContent(
          topic,
          relatedMessages,
          database,
        );
      }

      // Create or update document
      const result = await documentService.createOrUpdateDocument(
        topic,
        content,
        database,
      );
      Logger.info(
        `Document ${
          result.isUpdate ? "updated" : "created"
        }: ${result.filename} (ID: ${result.documentId})`,
      );
    }

    Logger.info("Document generation completed successfully!");
  } catch (error) {
    Logger.error(
      "Error generating documents",
      error instanceof Error ? error : undefined,
    );
    throw error;
  } finally {
    if (!db) {
      database.close();
      Logger.debug("Database connection closed");
    }
  }
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = Deno.args;

  try {
    const { startDate, endDate, userMention } = parseCommandArgs(args);

    // Set end date to end of day for inclusive range
    endDate.setHours(23, 59, 59, 999);

    console.log("Starting document generation...");
    console.log(`Progress: Initializing system components`);

    await generateDocuments(startDate, endDate, userMention);

    console.log(`Progress: Document generation completed successfully!`);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Missing required parameters" ||
        error.message === "Too many parameters provided"
      ) {
        console.error(`Error: ${error.message}`);
        console.error("");
        showUsage();
      } else {
        console.error(`Error: ${error.message}`);
      }
    } else {
      console.error("An unexpected error occurred:", error);
    }
    Deno.exit(1);
  }
}

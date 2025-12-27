import { DB } from "sqlite";
import { getTopicById, initDatabase } from "@/db/index.ts";
import { groupedMessagesToMarkdown } from "./markdownFormatter.ts";
import { getFilteredMessagesGrouped, MessageFilter } from "./messageRetriever.ts";
import { AppConfig, loadConfig, validateConfig } from "@/core/config/index.ts";
import { Logger } from "@/core/utils/logger.ts";
import * as validation from "@/core/utils/validation.ts";
import { AIService } from "@/core/agent/src/aiService.ts";
import { DocumentService } from "@/core/agent/src/documentService.ts";

/**
 * Interface for command line arguments
 */
interface GenerateCommandArgs {
  startDate: Date;
  endDate: Date;
  userContainings?: string[];
}

/**
 * Validates date format and returns Date object
 */
export function parseDate(dateStr: string, paramName: string): Date {
  return validation.parseAndValidateDate(dateStr, paramName);
}

/**
 * Parses and validates command line arguments
 */
export function parseCommandArgs(args: string[]): GenerateCommandArgs {
  if (args.length < 2) {
    throw new Error("Missing required parameters");
  }

  const startDate = parseDate(args[0], "start date");
  const endDate = parseDate(args[1], "end date");

  // Validate date range
  if (startDate > endDate) {
    throw new Error(
      `Start date (${args[0]}) must be before or equal to end date (${args[1]})`,
    );
  }

  // Parse multiple user containings (everything after the first two arguments)
  const userContainings = args.length > 2 ? args.slice(2) : undefined;

  // Validate user containing formats if provided
  if (userContainings && userContainings.length > 0) {
    for (const userContaining of userContainings) {
      const validationResult = validation.validateUserContaining(userContaining);
      if (!validationResult.isValid) {
        throw new Error(
          `Invalid user containing "${userContaining}": ${validationResult.error!}`,
        );
      }
    }
  }

  return {
    startDate,
    endDate,
    userContainings: userContainings?.map((containing) => containing.trim()),
  };
}

/**
 * Displays usage instructions
 */
function showUsage(): void {
  console.log(
    "Usage: deno task generate <start-date> <end-date> [user-containing1] [user-containing2] ...",
  );
  console.log("");
  console.log("Parameters:");
  console.log("  start-date       Start date in YYYY-MM-DD format");
  console.log("  end-date         End date in YYYY-MM-DD format");
  console.log(
    "  user-containing  Optional. Multiple users to filter messages by sender",
  );
  console.log("");
  console.log("User containing formats:");
  console.log("  @username        Username with @ prefix");
  console.log("  username         Username without @ prefix");
  console.log("  U123456          Slack user ID");
  console.log("");
  console.log("Examples:");
  console.log("  deno task generate 2025-12-20 2025-12-24");
  console.log("  deno task generate 2025-12-20 2025-12-24 @john.doe");
  console.log(
    "  deno task generate 2025-12-20 2025-12-24 @john.doe @jane.smith",
  );
  console.log(
    "  deno task generate 2025-12-20 2025-12-24 U123456789 john.doe",
  );
}

/**
 * Main document generation function
 */
export async function generateDocuments(
  startDate: Date,
  endDate: Date,
  userContainings?: string[],
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
    const dateRangeStr = userContainings && userContainings.length > 0
      ? `${startDate.toISOString()} to ${endDate.toISOString()} (filtering for messages from users: ${userContainings.join(", ")})`
      : `${startDate.toISOString()} to ${endDate.toISOString()}`;

    Logger.info(`Generating documents for messages from ${dateRangeStr}`);

    // Step 1: Get messages in time range with optional user containing filtering
    const filter: MessageFilter = {
      startDate,
      endDate,
      userContainings,
      includeThreads: true,
    };

    Logger.info("Retrieving messages from database");
    const groupedMessages = getFilteredMessagesGrouped(database, filter);

    const filterDescription = userContainings && userContainings.length > 0
      ? `messages from users "${userContainings.join(", ")}" in the specified time range`
      : `messages in the specified time range`;

    Logger.info(
      `Found ${groupedMessages.totalMessageCount} ${filterDescription} (${groupedMessages.threads.length} threads, ${groupedMessages.standaloneMessages.length} standalone messages)`,
    );

    if (groupedMessages.totalMessageCount === 0) {
      const noResultsMessage = userContainings && userContainings.length > 0
        ? `No messages found from users "${userContainings.join(", ")}" in the specified time range`
        : "No messages found in the specified time range";
      Logger.warn(noResultsMessage);
      return;
    }

    // Step 2: Convert grouped messages to markdown with thread structure preserved
    Logger.info("Converting grouped messages to markdown format");
    const messagesMarkdown = groupedMessagesToMarkdown(groupedMessages, database);

    // Step 3: Generate topics using AI
    Logger.info("Analyzing messages to identify topics using AI");
    const topicsResult = await aiService.generateTopics(messagesMarkdown, database);
    Logger.info(`Identified ${topicsResult.topics.length} topics`);

    // Helper function to get all messages from grouped structure
    const getAllMessages = () => [
      ...groupedMessages.threads.flatMap((thread) => [thread.parentMessage, ...thread.replies]),
      ...groupedMessages.standaloneMessages,
    ];

    // Step 4: Generate documents for each topic
    for (const topic of topicsResult.topics) {
      Logger.info(`Processing topic: ${topic.title}`);

      // Get related messages
      const allMessages = getAllMessages();
      const relatedMessages = allMessages.filter((msg) => topic.message_ids.includes(msg.id));

      if (relatedMessages.length === 0) {
        Logger.warn(`No related messages found for topic: ${topic.title}`);
        continue;
      }

      let isUpdate = false;
      let existingContent = "";

      // Check if topic has an existing ID (matched with existing topic)
      if (topic.id) {
        Logger.info(`Updating existing topic with ID ${topic.id}: ${topic.title}`);
        isUpdate = true;

        // Get existing document content for this topic
        const existingTopic = getTopicById(database, topic.id);
        if (existingTopic && existingTopic.file_name) {
          try {
            existingContent = await documentService.readDocument(existingTopic.file_name);
          } catch (error) {
            Logger.warn(`Could not read existing document for topic ${topic.id}, creating new content`);
            Logger.debug("Error details", { error: error instanceof Error ? error.message : String(error) });
            isUpdate = false;
          }
        }
      } else {
        Logger.info(`Creating new document for topic: ${topic.title}`);
      }

      // Generate document content
      const content = await aiService.generateDocumentContent(
        topic,
        relatedMessages,
        database,
        isUpdate,
        existingContent,
      );

      // Create or update document
      const result = await documentService.createOrUpdateDocument(
        topic,
        content,
        database,
      );
      Logger.info(
        `Document ${result.isUpdate ? "updated" : "created"}: ${result.filename} (ID: ${result.topicId})`,
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
    const { startDate, endDate, userContainings } = parseCommandArgs(args);

    // Set end date to end of day for inclusive range
    endDate.setHours(23, 59, 59, 999);

    console.log("Starting document generation...");
    console.log(`Progress: Initializing system components`);

    await generateDocuments(startDate, endDate, userContainings);

    console.log(`Progress: Document generation completed successfully!`);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Missing required parameters"
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

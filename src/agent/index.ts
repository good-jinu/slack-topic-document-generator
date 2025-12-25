import { DB } from "sqlite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { load } from "std/dotenv";
import { initDatabase } from "../db/index.ts";
import { getMessagesInTimeRange } from "./messageRetriever.ts";
import { messagesToMarkdown } from "./markdownFormatter.ts";
import { generateDocumentContent, generateTopics } from "./aiGenerator.ts";
import {
  createOrUpdateDocument,
  findSimilarDocument,
} from "./documentManager.ts";

/**
 * Main document generation function
 */
export async function generateDocuments(
  startDate: Date,
  endDate: Date,
  db?: DB,
): Promise<void> {
  // Load environment variables
  await load();

  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const database = db || initDatabase();

  try {
    console.log(
      `Generating documents for messages from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Step 1: Get messages in time range
    const messages = getMessagesInTimeRange(database, startDate, endDate);
    console.log(
      `Found ${messages.length} messages in the specified time range`,
    );

    if (messages.length === 0) {
      console.log("No messages found in the specified time range");
      return;
    }

    // Step 2: Convert messages to markdown
    const messagesMarkdown = messagesToMarkdown(messages, database);

    // Step 3: Generate topics using AI
    console.log("Analyzing messages to identify topics...");
    const topicsResult = await generateTopics(messagesMarkdown, genAI);
    console.log(`Identified ${topicsResult.topics.length} topics`);

    // Step 4: Generate documents for each topic
    for (const topic of topicsResult.topics) {
      console.log(`Processing topic: ${topic.title}`);

      // Get related messages
      const relatedMessages = messages.filter((msg) =>
        topic.message_ids.includes(msg.id)
      );

      if (relatedMessages.length === 0) {
        console.log(`No related messages found for topic: ${topic.title}`);
        continue;
      }

      // Check for similar existing document
      const existingDoc = await findSimilarDocument(
        topic.title,
        database,
      );
      let content: string;

      if (existingDoc) {
        const existingContent = await Deno.readTextFile(
          `db_docs/${existingDoc.name}`,
        );
        content = await generateDocumentContent(
          topic,
          relatedMessages,
          database,
          genAI,
          true,
          existingContent,
        );
      } else {
        content = await generateDocumentContent(
          topic,
          relatedMessages,
          database,
          genAI,
        );
      }

      // Create or update document
      const result = await createOrUpdateDocument(topic, content, database);
      console.log(
        `Document saved: ${result.filename} (ID: ${result.documentId})`,
      );
    }

    console.log("Document generation completed!");
  } catch (error) {
    console.error("Error generating documents:", error);
    throw error;
  } finally {
    if (!db) {
      database.close();
    }
  }
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = Deno.args;

  if (args.length < 2) {
    console.log("Usage: deno task generate <start_date> <end_date>");
    console.log("Date format: YYYY-MM-DD");
    console.log("Example: deno task generate 2025-12-20 2025-12-24");
    Deno.exit(1);
  }

  const startDate = new Date(args[0]);
  const endDate = new Date(args[1]);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error("Invalid date format. Use YYYY-MM-DD");
    Deno.exit(1);
  }

  // Set end date to end of day
  endDate.setHours(23, 59, 59, 999);

  try {
    await generateDocuments(startDate, endDate);
  } catch (error) {
    console.error("Failed to generate documents:", error);
    Deno.exit(1);
  }
}

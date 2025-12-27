import { DB } from "sqlite";
import { Logger } from "../utils/logger.ts";
import { AppConfig } from "../config/index.ts";
import { Topic } from "./aiService.ts";
import { getTopicByFileName, saveMessageTopicRelations, saveTopic } from "../db/index.ts";

export interface DocumentResult {
  topicId: number;
  filename: string;
  isUpdate: boolean;
}

export class DocumentService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Ensure documents directory exists
   */
  private async ensureDocumentsDirectory(): Promise<void> {
    try {
      await Deno.stat(this.config.output.documentsPath);
    } catch {
      Logger.info(
        `Creating documents directory: ${this.config.output.documentsPath}`,
      );
      await Deno.mkdir(this.config.output.documentsPath, { recursive: true });
    }
  }

  /**
   * Check if a similar document exists
   */
  async findSimilarDocument(
    title: string,
    db: DB,
  ): Promise<{ id: number; name: string } | null> {
    try {
      await this.ensureDocumentsDirectory();

      const files: string[] = [];
      for await (
        const dirEntry of Deno.readDir(this.config.output.documentsPath)
      ) {
        if (
          dirEntry.isFile &&
          dirEntry.name.endsWith(".md")
        ) {
          files.push(dirEntry.name);
        }
      }

      Logger.debug(
        `Checking ${files.length} existing documents for similarity`,
      );

      for (const file of files) {
        const filePath = `${this.config.output.documentsPath}/${file}`;
        const content = await Deno.readTextFile(filePath);
        const lines = content.split("\n");
        const fileTitle = lines.find((line) => line.startsWith("# "))?.replace("# ", "") || "";

        // Simple similarity check - could be enhanced with more sophisticated matching
        if (
          fileTitle.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(fileTitle.toLowerCase())
        ) {
          Logger.debug(`Found similar document: ${file}`, {
            fileTitle,
            searchTitle: title,
          });

          // Get topic from database
          const topic = getTopicByFileName(db, file);
          if (topic) {
            return { id: topic.id, name: file };
          }
        }
      }

      Logger.debug("No similar document found");
      return null;
    } catch (error) {
      Logger.error(
        "Error checking for similar documents",
        error instanceof Error ? error : undefined,
      );
      return null;
    }
  }

  /**
   * Create a safe filename from title
   */
  private createSafeFilename(title: string): string {
    // First try to create a meaningful filename from the title
    let filename = title
      .trim()
      // Replace spaces and special characters with hyphens
      .replace(/[\s\\/:"*?<>|]+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
      // Limit length
      .substring(0, 50)
      // Remove trailing hyphens again after substring
      .replace(/-+$/, "");

    // If the filename is empty or just hyphens after processing, use a timestamp-based name
    if (!filename || filename === "" || /^-*$/.test(filename)) {
      filename = `document-${Date.now()}`;
    }

    return `${filename}.md`;
  }

  /**
   * Create or update document file
   */
  async createOrUpdateDocument(
    topic: Topic,
    content: string,
    db: DB,
  ): Promise<DocumentResult> {
    await this.ensureDocumentsDirectory();

    const filename = this.createSafeFilename(topic.title);
    const filepath = `${this.config.output.documentsPath}/${filename}`;

    // Check if similar document exists
    const existingDoc = await this.findSimilarDocument(topic.title, db);

    if (existingDoc) {
      Logger.info(`Updating existing document: ${existingDoc.name}`);

      const existingPath = `${this.config.output.documentsPath}/${existingDoc.name}`;
      await Deno.writeTextFile(existingPath, content);

      // Update topic with new information
      const topicId = saveTopic(db, topic.title, topic.description, existingDoc.name, undefined, undefined, true);

      // Add relations for all message IDs
      const relations = topic.message_ids.map((id) => ({
        message_id: id,
        topic_id: topicId,
      }));
      saveMessageTopicRelations(db, relations);

      Logger.info(`Document updated successfully: ${existingDoc.name}`, {
        topicId,
        messageCount: topic.message_ids.length,
      });

      return {
        topicId,
        filename: existingDoc.name,
        isUpdate: true,
      };
    } else {
      Logger.info(`Creating new document: ${filename}`);

      await Deno.writeTextFile(filepath, content);

      // Save topic to database
      const topicId = saveTopic(db, topic.title, topic.description, filename);

      // Add relations for all message IDs
      const relations = topic.message_ids.map((id) => ({
        message_id: id,
        topic_id: topicId,
      }));
      saveMessageTopicRelations(db, relations);

      Logger.info(`Document created successfully: ${filename}`, {
        topicId,
        messageCount: topic.message_ids.length,
      });

      return {
        topicId,
        filename,
        isUpdate: false,
      };
    }
  }

  /**
   * Read existing document content
   */
  async readDocument(filename: string): Promise<string> {
    const filepath = `${this.config.output.documentsPath}/${filename}`;
    try {
      return await Deno.readTextFile(filepath);
    } catch (error) {
      Logger.error(
        `Failed to read document: ${filename}`,
        error instanceof Error ? error : undefined,
      );
      throw new Error(`Could not read document: ${filename}`);
    }
  }
}

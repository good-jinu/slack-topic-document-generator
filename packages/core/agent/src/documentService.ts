import { DB } from "sqlite";
import { Logger } from "@/core/utils/logger.ts";
import { AppConfig } from "@/core/config/index.ts";
import { Topic } from "@/core/agent/schemas.ts";
import { getTopicById, saveMessageTopicRelations, saveTopic } from "@/db/index.ts";

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
   * Get existing document info from database using topic ID
   */
  private getExistingDocument(
    topicId: number,
    db: DB,
  ): { id: number; filename: string } | null {
    try {
      // Get topic from database using topic ID
      const topic = getTopicById(db, topicId);
      if (topic && topic.file_name) {
        return { id: topic.id, filename: topic.file_name };
      }
      return null;
    } catch (error) {
      Logger.error("Error getting existing document", error instanceof Error ? error : undefined);
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

    // Check if topic already exists in database (has an ID)
    if (topic.id) {
      // Topic exists - update existing document
      const existingDoc = this.getExistingDocument(topic.id, db);

      if (existingDoc && existingDoc.filename) {
        Logger.info(`Updating existing document: ${existingDoc.filename}`);

        const existingPath = `${this.config.output.documentsPath}/${existingDoc.filename}`;
        await Deno.writeTextFile(existingPath, content);

        // Update topic with new information
        const topicId = saveTopic(db, topic.title, topic.description, existingDoc.filename, topic.message_ids, true);

        // Add relations for all message IDs
        const relations = topic.message_ids.map((id) => ({
          message_id: id,
          topic_id: topicId,
        }));
        saveMessageTopicRelations(db, relations);

        Logger.info(`Document updated successfully: ${existingDoc.filename}`, {
          topicId,
          messageCount: topic.message_ids.length,
        });

        return {
          topicId,
          filename: existingDoc.filename,
          isUpdate: true,
        };
      }
    }

    // Topic doesn't exist or no existing document - create new document
    const filename = this.createSafeFilename(topic.title);
    const filepath = `${this.config.output.documentsPath}/${filename}`;

    Logger.info(`Creating new document: ${filename}`);

    await Deno.writeTextFile(filepath, content);

    // Save topic to database
    const topicId = saveTopic(db, topic.title, topic.description, filename, topic.message_ids);

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

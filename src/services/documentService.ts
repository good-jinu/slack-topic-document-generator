import { DB } from "sqlite";
import { Logger } from "../utils/logger.ts";
import { AppConfig } from "../config/index.ts";
import { Topic } from "./aiService.ts";
import {
  getDocumentByName,
  saveDocument,
  saveMessageDocumentRelations,
} from "../db/index.ts";

export interface DocumentResult {
  documentId: number;
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
          dirEntry.name.endsWith(`.${this.config.output.format}`)
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
        const fileTitle = lines.find((line) =>
          line.startsWith("# ")
        )?.replace("# ", "") || "";

        // Simple similarity check - could be enhanced with more sophisticated matching
        if (
          fileTitle.toLowerCase().includes(title.toLowerCase()) ||
          title.toLowerCase().includes(fileTitle.toLowerCase())
        ) {
          Logger.debug(`Found similar document: ${file}`, {
            fileTitle,
            searchTitle: title,
          });

          // Get document from database
          const document = getDocumentByName(db, file);
          if (document) {
            return { id: document.id, name: file };
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
    const extension = this.config.output.format === "markdown" ? "md" : "html";
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50) + `.${extension}`;
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

      const existingPath =
        `${this.config.output.documentsPath}/${existingDoc.name}`;
      await Deno.writeTextFile(existingPath, content);

      // Update document timestamp
      const documentId = saveDocument(db, existingDoc.name, true);

      // Add relations for all message IDs
      const relations = topic.message_ids.map((id) => ({
        message_id: id,
        document_id: documentId,
      }));
      saveMessageDocumentRelations(db, relations);

      Logger.info(`Document updated successfully: ${existingDoc.name}`, {
        documentId,
        messageCount: topic.message_ids.length,
      });

      return {
        documentId,
        filename: existingDoc.name,
        isUpdate: true,
      };
    } else {
      Logger.info(`Creating new document: ${filename}`);

      await Deno.writeTextFile(filepath, content);

      // Save document to database
      const documentId = saveDocument(db, filename, false);

      // Add relations for all message IDs
      const relations = topic.message_ids.map((id) => ({
        message_id: id,
        document_id: documentId,
      }));
      saveMessageDocumentRelations(db, relations);

      Logger.info(`Document created successfully: ${filename}`, {
        documentId,
        messageCount: topic.message_ids.length,
      });

      return {
        documentId,
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

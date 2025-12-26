import { DB } from "sqlite";
import { getDocumentByName, saveDocument, saveMessageDocumentRelations } from "../db/index.ts";

/**
 * Check if a similar document exists
 */
export async function findSimilarDocument(
  title: string,
  db: DB,
): Promise<{ id: number; name: string } | null> {
  try {
    const files: string[] = [];
    for await (const dirEntry of Deno.readDir("db_docs")) {
      if (dirEntry.isFile && dirEntry.name.endsWith(".md")) {
        files.push(dirEntry.name);
      }
    }

    for (const file of files) {
      const content = await Deno.readTextFile(`db_docs/${file}`);
      const lines = content.split("\n");
      const fileTitle = lines.find((line) => line.startsWith("# "))?.replace("# ", "") || "";

      // Simple similarity check - you might want to use more sophisticated matching
      if (
        fileTitle.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(fileTitle.toLowerCase())
      ) {
        // Get document from database
        const document = getDocumentByName(db, file);
        if (document) {
          return { id: document.id, name: file };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create or update document file
 */
export async function createOrUpdateDocument(
  topic: { title: string; description: string; message_ids: number[] },
  content: string,
  db: DB,
): Promise<{ documentId: number; filename: string }> {
  // Create a safe filename from the title
  const filename = topic.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50) + ".md";

  const filepath = `db_docs/${filename}`;

  // Check if similar document exists
  const existingDoc = await findSimilarDocument(
    topic.title,
    db,
  );

  if (existingDoc) {
    console.log(`Updating existing document: ${existingDoc.name}`);
    await Deno.writeTextFile(`db_docs/${existingDoc.name}`, content);

    // Update document timestamp
    const documentId = saveDocument(db, existingDoc.name, true);

    // Add relations for all message IDs
    const relations = topic.message_ids.map((id) => ({
      message_id: id,
      document_id: documentId,
    }));
    saveMessageDocumentRelations(db, relations);

    return { documentId, filename: existingDoc.name };
  } else {
    console.log(`Creating new document: ${filename}`);
    await Deno.writeTextFile(filepath, content);

    // Save document to database
    const documentId = saveDocument(db, filename, false);

    // Add relations for all message IDs
    const relations = topic.message_ids.map((id) => ({
      message_id: id,
      document_id: documentId,
    }));
    saveMessageDocumentRelations(db, relations);

    return { documentId, filename };
  }
}

import { getDocuments, getGroups, getMentions, getMessageDocumentRelations, getMessages, getUsers, initDatabase } from "../db/index.ts";

/**
 * Main viewer function
 */
function viewData() {
  const db = initDatabase();

  try {
    const limit = 10;

    // View Messages
    const messages = getMessages(db, 50);
    console.log(`\n=== Last ${messages.length} messages in database ===\n`);
    if (messages.length > 0) {
      console.table(
        messages.map((m) => ({
          Time: new Date(m.created_at).toLocaleString(),
          Channel: m.channel_name,
          User: m.user_name,
          Text: m.text.length > 50 ? m.text.slice(0, 50) + "..." : m.text,
          Thread: m.thread_id || "-",
        })),
      );
    } else {
      console.log("No messages found.");
    }

    // View Users
    const users = getUsers(db, limit);
    console.log(`\n=== Last ${users.length} users in database ===\n`);
    if (users.length > 0) {
      console.table(
        users.map((u) => ({
          "User ID": u.user_id,
          Name: u.user_name,
          Nickname: u.nickname || "-",
        })),
      );
    } else {
      console.log("No users found.");
    }

    // View Groups
    const groups = getGroups(db, limit);
    console.log(`\n=== Last ${groups.length} groups in database ===\n`);
    if (groups.length > 0) {
      console.table(
        groups.map((g) => ({
          "Group ID": g.group_id,
          Name: g.group_name,
          Handle: g.handle || "-",
        })),
      );
    } else {
      console.log("No groups found.");
    }

    // View Mentions
    const mentions = getMentions(db, limit);
    console.log(`\n=== Last ${mentions.length} mentions in database ===\n`);
    if (mentions.length > 0) {
      console.table(
        mentions.map((men) => ({
          Channel: men.channel_id,
          "Message TS": men.message_ts,
          "Mentioned User": men.user_id,
        })),
      );
    } else {
      console.log("No mentions found.");
    }

    // View Documents
    const documents = getDocuments(db, limit);
    console.log(`\n=== Last ${documents.length} documents in database ===\n`);
    if (documents.length > 0) {
      console.table(
        documents.map((doc) => ({
          ID: doc.id,
          Name: doc.name,
          "Created At": new Date(doc.created_at).toLocaleString(),
          "Updated At": new Date(doc.updated_at).toLocaleString(),
        })),
      );
    } else {
      console.log("No documents found.");
    }

    // View Message-Document Relations
    const relations = getMessageDocumentRelations(
      db,
      undefined,
      undefined,
      limit,
    );
    console.log(
      `\n=== Last ${relations.length} message-document relations in database ===\n`,
    );
    if (relations.length > 0) {
      console.table(
        relations.map((rel) => ({
          "Message ID": rel.message_id,
          "Document ID": rel.document_id,
          "Document Name": rel.document_name,
        })),
      );
    } else {
      console.log("No message-document relations found.");
    }
  } catch (error) {
    console.error("Error viewing data:", error);
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  viewData();
}

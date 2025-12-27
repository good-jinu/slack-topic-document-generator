import { getGroups, getMentions, getMessages, getMessageTopicRelations, getTopics, getUsers, initDatabase } from "../db/index.ts";

/**
 * Main viewer function
 */
function viewData() {
  const db = initDatabase();

  try {
    const limit = 10;

    // View Messages
    const messages = getMessages(db, limit);
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

    // View Topics
    const topics = getTopics(db, limit);
    console.log(`\n=== Last ${topics.length} topics in database ===\n`);
    if (topics.length > 0) {
      console.table(
        topics.map((topic) => ({
          ID: topic.id,
          Title: topic.title,
          Description: topic.description ? (topic.description.length > 30 ? topic.description.slice(0, 30) + "..." : topic.description) : "-",
          "File Name": topic.file_name || "-",
          "Start Date": topic.start_date ? new Date(topic.start_date).toLocaleDateString() : "-",
          "End Date": topic.end_date ? new Date(topic.end_date).toLocaleDateString() : "-",
          "Created At": new Date(topic.created_at).toLocaleString(),
          "Updated At": new Date(topic.updated_at).toLocaleString(),
        })),
      );
    } else {
      console.log("No topics found.");
    }

    // View Message-Topic Relations
    const relations = getMessageTopicRelations(
      db,
      undefined,
      undefined,
      limit,
    );
    console.log(
      `\n=== Last ${relations.length} message-topic relations in database ===\n`,
    );
    if (relations.length > 0) {
      console.table(
        relations.map((rel) => ({
          "Message ID": rel.message_id,
          "Topic ID": rel.topic_id,
          "Topic Title": rel.topic_title,
          "Topic File": rel.topic_file_name || "-",
        })),
      );
    } else {
      console.log("No message-topic relations found.");
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

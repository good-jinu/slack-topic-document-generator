import { GoogleGenerativeAI } from "@google/generative-ai";
import { DB } from "sqlite";
import { SlackMessage } from "../utils/types.ts";
import { parseMessage } from "./messageParser.ts";

const MODEL_ID = "gemini-2.5-flash-lite";

/**
 * Generate topics using Google AI
 */
export async function generateTopics(
  messagesMarkdown: string,
  genAI: GoogleGenerativeAI,
): Promise<{
  topics: Array<{
    title: string;
    description: string;
    message_ids: number[];
  }>;
}> {
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const prompt = `
Analyze the following Slack messages and identify distinct topics that were discussed. 
For each topic, provide:
1. A clear, concise title
2. A brief description of what was discussed
3. The message IDs that relate to this topic (extract from "Message ID: X" lines)

Return the result as a JSON object with this structure:
{
  "topics": [
    {
      "title": "Topic Title",
      "description": "Brief description of the topic",
      "message_ids": [1, 2, 3]
    }
  ]
}

Make sure each topic has at least one message_id associated with it.
Group related messages under the same topic when they discuss similar subjects.

Messages to analyze:
${messagesMarkdown}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Add delay to prevent rate limiting
  await new Promise((resolve) => setTimeout(resolve, 10000));

  try {
    // Clean the response to extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error parsing AI response:", error);
    console.log("Raw response:", text);
    throw error;
  }
}

/**
 * Generate document content using Google AI
 */
export async function generateDocumentContent(
  topic: { title: string; description: string; message_ids: number[] },
  relatedMessages: (SlackMessage & { id: number })[],
  db: DB,
  genAI: GoogleGenerativeAI,
  isUpdate = false,
  existingContent = "",
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const messagesText = relatedMessages.map((msg) => {
    const parsedText = parseMessage(msg.text, db);
    const date = new Date(msg.created_at).toLocaleString();
    return `[${date}] ${msg.user_name} in ${msg.channel_name}: ${parsedText}`;
  }).join("\n");

  const prompt = isUpdate
    ? `
Update the following document with new information from recent Slack messages.
Add the new context while maintaining the existing structure and avoiding duplication.

Existing document:
${existingContent}

New messages to incorporate:
${messagesText}

Topic: ${topic.title}
Description: ${topic.description}

Please update the document to include the new information while maintaining a coherent structure.
`
    : `
Create a comprehensive document based on the following Slack messages discussion.

Topic: ${topic.title}
Description: ${topic.description}

Related messages:
${messagesText}

Please create a well-structured markdown document that:
1. Summarizes the key points discussed
2. Organizes information logically
3. Includes relevant details and decisions made
4. Uses proper markdown formatting
5. Starts with a clear title using # ${topic.title}

Make it professional and easy to understand for someone who wasn't part of the original conversation.
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;

  // Add delay to prevent rate limiting
  await new Promise((resolve) => setTimeout(resolve, 10000));

  return response.text();
}

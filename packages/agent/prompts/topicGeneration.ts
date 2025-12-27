/**
 * Prompt templates for topic generation using three-step approach
 */

/**
 * Step 1: Analysis prompt - helps AI think about topic distinctions
 */
export function createTopicAnalysisPrompt(messagesMarkdown: string): string {
  return `
Analyze the following Slack messages and think about how to identify distinct topics.

First, carefully read through all the messages and think about:
1. What are the main subjects being discussed?
2. How can we group related messages together?
3. Which messages belong to which topics based on their content?

For each topic you identify, explain your reasoning for grouping those messages together.
Include the message IDs (extract from "Message ID: X" lines) that belong to each topic.

Messages to analyze:
${messagesMarkdown}

Please provide your analysis and reasoning first, then list the topics you've identified.
`;
}

/**
 * Step 2: Formatting and matching prompt - converts analysis to JSON and checks for existing topics
 */
export function createTopicFormattingAndMatchingPrompt(
  thinkingContent: string,
  messagesMarkdown: string,
  existingTopicsText: string,
): string {
  return `
Based on your previous analysis, now format the identified topics into a JSON structure.
At the same time, check if any of your topics are similar to existing topics in the database.

Your previous analysis:
${thinkingContent}

Here are the existing topics in the database:
${existingTopicsText}

Now create a JSON object with this exact structure:
{
  "topics": [
    {
      "title": "API Performance Optimization",
      "description": "Discussion about database query optimization and caching strategies",
      "message_ids": [123, 124, 127],
      "id": 5
    },
    {
      "title": "New Feature Requirements",
      "description": "Requests for user dashboard improvements and notification system additions",
      "message_ids": [125, 126, 128]
    }
  ]
}

Requirements:
- Each topic must have at least one message_id
- Use clear, concise titles
- Provide meaningful descriptions
- Only include message IDs that actually exist in the original messages
- If a topic is similar to an existing topic in the database (similar title, description, or subject matter), add the existing topic's "id" field
- Only add the "id" field if you found the topics are discussing similar subject matter
- Return ONLY the JSON object, no additional text

Original messages for reference:
${messagesMarkdown}
`;
}

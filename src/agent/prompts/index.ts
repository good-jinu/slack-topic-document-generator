/**
 * Centralized exports for all prompt templates
 */

// Topic generation prompts
export { createTopicAnalysisPrompt, createTopicFormattingAndMatchingPrompt } from "./topicGeneration.ts";

// Document generation prompts
export { createNewDocumentPrompt, createUpdateDocumentPrompt, formatMessagesForDocument } from "./documentGeneration.ts";

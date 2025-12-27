# Agent Prompts

This directory contains all prompt templates used by the AI agent for various tasks. The prompts have been extracted from the service layer to improve maintainability and reusability.

## Structure

### Topic Generation (`topicGeneration.ts`)

Contains the two-step topic generation process:

1. **Analysis Phase** (`createTopicAnalysisPrompt`): Helps the AI think through how to distinguish and group topics from Slack messages
2. **Formatting and Matching Phase** (`createTopicFormattingAndMatchingPrompt`): Converts the analysis into structured JSON format while simultaneously checking against existing database topics and adding IDs for matches

### Document Generation (`documentGeneration.ts`)

Contains prompts for creating and updating documents:

- **New Document** (`createNewDocumentPrompt`): Creates comprehensive documents from scratch based on topics and messages
- **Update Document** (`createUpdateDocumentPrompt`): Updates existing documents with new information while maintaining structure
- **Message Formatting** (`formatMessagesForDocument`): Helper function to format messages consistently for document generation

## Usage

Import the needed prompt functions from the index file:

```typescript
import {
  createNewDocumentPrompt,
  createTopicAnalysisPrompt,
  // ... other prompts
} from "../agent/prompts/index.ts";
```

## Benefits of This Structure

1. **Separation of Concerns**: Prompts are separated from business logic
2. **Reusability**: Prompt templates can be reused across different services
3. **Maintainability**: Easy to modify prompts without touching service code
4. **Testing**: Prompts can be unit tested independently
5. **Consistency**: Centralized prompt management ensures consistent AI interactions

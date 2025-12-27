# LLM Provider Abstraction

This module provides a common interface for different LLM providers, allowing the agent to work with various AI services without changing the core logic. It uses Zod schemas for structured output validation.

## Architecture

- `index.ts` - Main interface and factory function
- `google-genai.ts` - Google Generative AI implementation with Zod support
- `mock-provider.ts` - Mock provider for testing
- `../schemas.ts` - Zod schemas for structured responses

## Adding a New Provider

To add a new LLM provider:

1. Create a new file (e.g., `openai-provider.ts`)
2. Implement the `LLMProvider` interface:

```typescript
import { z } from "zod";
import { LLMConfig, LLMProvider } from "./index.ts";

export class OpenAIProvider implements LLMProvider {
  constructor(config: LLMConfig) {
    // Initialize your provider
  }

  async generateContent(prompt: string): Promise<string> {
    // Implement text generation
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    // Implement structured response generation with Zod validation
    // Use schema.parse() to validate the response
  }
}
```

3. Update the factory function in `index.ts`:

```typescript
import { OpenAIProvider } from "./openai-provider.ts";

// In createLLMProvider function:
case "openai":
  return new OpenAIProvider(llmConfig);
```

4. Update the configuration to support the new provider by setting `AI_PROVIDER=openai` in your environment variables.

## Configuration

The LLM provider is configured through environment variables:

- `AI_PROVIDER` - Provider name (default: "google-genai")
- `AI_MODEL` - Model to use
- `AI_MAX_RETRIES` - Maximum retry attempts
- `AI_RATE_LIMIT_DELAY` - Delay between requests

## Interface

### LLMProvider

```typescript
interface LLMProvider {
  generateContent(prompt: string): Promise<string>;
  generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T>;
}
```

- `generateContent` - Generate plain text responses
- `generateStructuredResponse` - Generate and validate structured responses using Zod schemas

## Structured Output with Zod

The system uses Zod schemas for type-safe structured outputs:

```typescript
import { TopicsResultSchema } from "../schemas.ts";

const result = await llmProvider.generateStructuredResponse(
  prompt,
  TopicsResultSchema,
);
// result is fully typed and validated
```

This ensures:

- Type safety at compile time
- Runtime validation of AI responses
- Better error handling for malformed responses
- Automatic JSON schema generation for providers that support it (like Google GenAI)

/**
 * Mock LLM Provider Implementation
 *
 * This is an example implementation showing how to add new LLM providers.
 * This mock provider can be used for testing or development purposes.
 */

import { z } from "zod";
import { LLMConfig, LLMProvider } from "./index.ts";
import { Logger } from "@/core/utils/logger.ts";

export class MockLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Generate mock text content
   */
  async generateContent(prompt: string): Promise<string> {
    Logger.debug("Generating mock content");

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return `Mock response for prompt: ${prompt.substring(0, 50)}...`;
  }

  /**
   * Generate mock structured response using Zod schema
   */
  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    Logger.debug("Generating mock structured response");

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Return a mock topics response structure that matches the schema
    const mockResponse = {
      topics: [
        {
          title: "Mock Topic",
          description: `This is a mock topic generated for testing for ${prompt}`,
          message_ids: [1, 2, 3],
        },
      ],
    };

    // Validate against the schema before returning
    return schema.parse(mockResponse);
  }
}

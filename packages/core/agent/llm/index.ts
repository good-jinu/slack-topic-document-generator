/**
 * LLM Provider using Vercel AI SDK
 *
 * This module provides a unified interface for different LLM providers
 * using the Vercel AI SDK, which handles provider-specific implementations.
 */

import { z } from "zod";
import { generateObject, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { AppConfig } from "@topicgen/core/config/index.ts";
import { Logger } from "@topicgen/core/utils/logger.ts";
import { RetryOptions, withRetry } from "@topicgen/core/utils/retry.ts";

/**
 * Common interface for all LLM providers
 */
export interface LLMProvider {
  /**
   * Generate text content based on a prompt
   */
  generateContent(prompt: string): Promise<string>;

  /**
   * Generate structured response using Zod schema validation
   */
  generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T>;
}

/**
 * Configuration for LLM providers
 */
export interface LLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  maxRetries: number;
  rateLimitDelay: number;
  baseURL?: string;
}

/**
 * Unified LLM Provider using Vercel AI SDK
 */
export class AISDKProvider implements LLMProvider {
  private config: LLMConfig;
  private retryOptions: RetryOptions;
  private model: ReturnType<ReturnType<typeof createGoogleGenerativeAI | typeof createOpenAI>>;

  constructor(config: LLMConfig) {
    this.config = config;
    this.retryOptions = {
      maxRetries: config.maxRetries,
      delay: config.rateLimitDelay,
      backoffMultiplier: 1.5,
      maxDelay: 60000,
    };
    this.model = this.createModel();
  }

  private createModel() {
    const provider = this.config.provider.toLowerCase();

    switch (provider) {
      case "google-genai":
      case "google": {
        const google = createGoogleGenerativeAI({
          apiKey: this.config.apiKey,
        });
        return google(this.config.model);
      }

      case "openai": {
        const openai = createOpenAI({
          apiKey: this.config.apiKey,
          ...(this.config.baseURL && { baseURL: this.config.baseURL }),
        });
        return openai(this.config.model);
      }

      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Generate text content based on a prompt
   */
  async generateContent(prompt: string): Promise<string> {
    Logger.debug(`Generating content with ${this.config.provider}`);

    return await withRetry(async () => {
      const { text } = await generateText({
        model: this.model,
        prompt,
      });

      Logger.debug("Successfully generated content");
      return text;
    }, this.retryOptions);
  }

  /**
   * Generate structured response using Zod schema validation
   */
  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    Logger.debug(`Generating structured response with ${this.config.provider}`);

    return await withRetry(async () => {
      const { object } = await generateObject({
        model: this.model,
        schema,
        prompt,
      });

      Logger.debug("Successfully generated and validated structured response");
      return object as T;
    }, this.retryOptions);
  }
}

/**
 * Factory function to create LLM provider instances
 */
export function createLLMProvider(config: AppConfig): LLMProvider {
  const llmConfig: LLMConfig = {
    provider: config.ai.provider || "google-genai",
    apiKey: config.ai.apiKey,
    model: config.ai.model,
    maxRetries: config.ai.maxRetries,
    rateLimitDelay: config.ai.rateLimitDelay,
    baseURL: config.ai.baseURL,
  };

  // Mock provider for testing
  if (llmConfig.provider.toLowerCase() === "mock") {
    return new MockLLMProvider(llmConfig);
  }

  return new AISDKProvider(llmConfig);
}

/**
 * Mock LLM Provider for testing
 */
export class MockLLMProvider implements LLMProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async generateContent(prompt: string): Promise<string> {
    Logger.debug("Generating mock content");
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `Mock response for prompt: ${prompt.substring(0, 50)}...`;
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    Logger.debug("Generating mock structured response");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const mockResponse = {
      topics: [
        {
          title: "Mock Topic",
          description: `This is a mock topic generated for testing for ${prompt}`,
          message_ids: [1, 2, 3],
        },
      ],
    };

    return schema.parse(mockResponse);
  }
}

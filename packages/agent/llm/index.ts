/**
 * LLM Provider Interface and Factory
 *
 * This module provides a common interface for different LLM providers
 * and a factory function to create instances based on configuration.
 */

import { z } from "zod";
import { AppConfig } from "@/shared/config/index.ts";
import { GoogleGenAIProvider } from "./google-genai.ts";
import { MockLLMProvider } from "./mock-provider.ts";
import { OpenAIProvider } from "./openai.ts";

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
  baseURL?: string; // Optional base URL for OpenAI-compatible APIs
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

  switch (llmConfig.provider.toLowerCase()) {
    case "google-genai":
    case "google":
      return new GoogleGenAIProvider(llmConfig);

    case "openai":
      return new OpenAIProvider(llmConfig);

    case "mock":
      return new MockLLMProvider(llmConfig);

    default:
      throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
  }
}

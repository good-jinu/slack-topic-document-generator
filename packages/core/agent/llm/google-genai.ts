/**
 * Google Generative AI Provider Implementation
 */

import { GoogleGenerativeAI, ResponseSchema } from "@google/generative-ai";
import { z } from "zod";
import { LLMConfig, LLMProvider } from "./index.ts";
import { Logger } from "@/core/utils/logger.ts";
import { RetryOptions, withRetry } from "@/core/utils/retry.ts";

export class GoogleGenAIProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private config: LLMConfig;
  private retryOptions: RetryOptions;

  constructor(config: LLMConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.retryOptions = {
      maxRetries: config.maxRetries,
      delay: config.rateLimitDelay,
      backoffMultiplier: 1.5,
      maxDelay: 60000,
    };
  }

  /**
   * Generate text content based on a prompt
   */
  async generateContent(prompt: string): Promise<string> {
    Logger.debug("Generating content with Google GenAI");

    return await withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.config.model,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      Logger.debug("Successfully generated content with Google GenAI");
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
    Logger.debug("Generating structured response with Google GenAI");

    return await withRetry(async () => {
      const model = this.genAI.getGenerativeModel({
        model: this.config.model,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: z.toJSONSchema(schema) as ResponseSchema,
        },
      });

      const response = await result.response;
      const text = response.text();

      try {
        const parsed = JSON.parse(text);
        const validated = schema.parse(parsed);
        Logger.debug(
          "Successfully generated and validated structured response",
        );
        return validated;
      } catch (error) {
        Logger.error(
          "Error parsing or validating AI structured response",
          error instanceof Error ? error : undefined,
        );
        Logger.debug("Raw AI response", { response: text });
        throw error;
      }
    }, this.retryOptions);
  }
}

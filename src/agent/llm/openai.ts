/**
 * OpenAI-Compatible Provider Implementation
 *
 * This provider uses the OpenAI SDK to interact with OpenAI API or any
 * OpenAI-compatible API (like NVIDIA, Azure OpenAI, etc.) by configuring
 * the base URL and API key.
 */

import OpenAI from "openai";
import { z } from "zod";
import { LLMConfig, LLMProvider } from "./index.ts";
import { Logger } from "../../utils/logger.ts";
import { RetryOptions, withRetry } from "../../utils/retry.ts";

export class OpenAIProvider implements LLMProvider {
  private config: LLMConfig;
  private retryOptions: RetryOptions;
  private client: OpenAI;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    });
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
    Logger.debug("Generating content with OpenAI-compatible API");

    return await withRetry(async () => {
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 16384,
        stream: false,
        // Provider-specific parameters (optional)
        ...(this.config.model.includes("nemotron") && {
          // @ts-ignore - These are NVIDIA-specific parameters
          reasoning_budget: 16384,
          chat_template_kwargs: {
            enable_thinking: true,
          },
        }),
      });

      if (!completion.choices?.[0]?.message?.content) {
        throw new Error("Invalid response from API");
      }

      const content = completion.choices[0].message.content;
      Logger.debug("Successfully generated content");
      return content;
    }, this.retryOptions);
  }

  /**
   * Generate structured response using Zod schema validation
   */
  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    Logger.debug("Generating structured response with OpenAI-compatible API");

    return await withRetry(async () => {
      // Create a prompt that requests JSON output
      const structuredPrompt = `${prompt}

Please respond with a valid JSON object that matches the following requirements. Do not include any additional text or formatting - only return the JSON object.`;

      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that responds with valid JSON objects only.",
          },
          {
            role: "user",
            content: structuredPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent structured output
        top_p: 1,
        max_tokens: 16384,
        stream: false,
      });

      if (!completion.choices?.[0]?.message?.content) {
        throw new Error("Invalid response from API");
      }

      const content = completion.choices[0].message.content;

      try {
        // Try to extract JSON from the response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : content;

        const parsed = JSON.parse(jsonText);
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
        Logger.debug("Raw AI response", { response: content });
        throw error;
      }
    }, this.retryOptions);
  }

  /**
   * Generate streaming content (useful for real-time applications)
   * Returns an async generator that yields content chunks
   */
  async *generateStreamingContent(prompt: string): AsyncGenerator<string, void, unknown> {
    Logger.debug("Generating streaming content with OpenAI-compatible API");

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      top_p: 1,
      max_tokens: 16384,
      stream: true,
      // Provider-specific parameters (optional)
      ...(this.config.model.includes("nemotron") && {
        // @ts-ignore - These are NVIDIA-specific parameters
        reasoning_budget: 16384,
        chat_template_kwargs: {
          enable_thinking: true,
        },
      }),
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }

    Logger.debug("Successfully completed streaming content generation");
  }
}

/**
 * BenchAgent - Core agent for running benchmarks using OpenAI API
 *
 * Provides LLM interaction with retry logic, token tracking, and cost calculation.
 */

import OpenAI from 'openai';
import { CostTracker, TokenUsage, CostInfo } from './cost-tracker';

export interface AgentConfig {
  name?: string;
  model?: string;
  instructions?: string;
  apiKey?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface TestResult {
  test_name: string;
  prompt: string;
  response: string | null;
  model: string;
  agent_name: string;
  execution_time: number;
  status: 'success' | 'error';
  error?: string;
  retry_attempts?: number;
  timestamp: string;
  token_usage?: TokenUsage;
  cost?: CostInfo;
}

/**
 * A simple agent wrapper for running LLM benchmarks.
 */
export class BenchAgent {
  private name: string;
  private model: string;
  private instructions: string;
  private client: OpenAI;
  private maxRetries: number;

  constructor(config: AgentConfig = {}) {
    this.name = config.name || 'BenchAgent';
    this.model = config.model || 'gpt-4o-mini';
    this.maxRetries = config.maxRetries || 3;

    this.instructions =
      config.instructions ||
      `You are a helpful AI assistant designed for benchmarking tasks.
Provide clear, accurate, and detailed responses.
Follow instructions precisely and maintain consistency in your responses.`;

    // Initialize OpenAI client
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.client = new OpenAI({
      apiKey,
      timeout: config.timeout || 60000,
    });
  }

  /**
   * Get the model name.
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the agent name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Run a single benchmark test with retry logic.
   */
  async runTest(prompt: string, testName?: string): Promise<TestResult> {
    const startTime = Date.now();
    const finalTestName =
      testName || `test_${new Date().toISOString().replace(/[:.]/g, '_')}`;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(
            `🔄 Retry attempt ${attempt + 1}/${this.maxRetries} after ${waitTime / 1000}s...`
          );
          await this.sleep(waitTime);
        }

        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.instructions },
            { role: 'user', content: prompt },
          ],
        });

        const endTime = Date.now();
        const response = completion.choices[0]?.message?.content || '';

        // Check for empty response
        if (!response || response.trim().length === 0) {
          const errorMsg = `Agent returned empty response. Check API key for model '${this.model}'.`;
          if (attempt < this.maxRetries - 1) {
            console.warn(`⚠️  ${errorMsg} - Retrying...`);
            lastError = errorMsg;
            continue;
          }
          return this.createErrorResult(
            finalTestName,
            prompt,
            startTime,
            errorMsg,
            attempt + 1
          );
        }

        // Extract token usage
        const tokenUsage = this.extractTokenUsage(completion, prompt, response);
        const costInfo = this.calculateCost(tokenUsage);

        const result: TestResult = {
          test_name: finalTestName,
          prompt,
          response,
          model: this.model,
          agent_name: this.name,
          execution_time: (endTime - startTime) / 1000,
          status: 'success',
          timestamp: new Date().toISOString(),
          token_usage: tokenUsage,
          cost: costInfo,
        };

        if (attempt > 0) {
          result.retry_attempts = attempt + 1;
          console.log(`✅ Succeeded after ${attempt + 1} attempt(s)`);
        }

        return result;
      } catch (error) {
        const errorMsg = `Agent '${this.name}' failed with model '${this.model}': ${error instanceof Error ? error.message : String(error)}`;

        if (attempt < this.maxRetries - 1) {
          console.warn(`⚠️  ${errorMsg} - Retrying...`);
          lastError = errorMsg;
          continue;
        }

        return this.createErrorResult(
          finalTestName,
          prompt,
          startTime,
          errorMsg,
          attempt + 1
        );
      }
    }

    // Should never reach here
    return this.createErrorResult(
      finalTestName,
      prompt,
      startTime,
      lastError || 'Unknown error after retries',
      this.maxRetries
    );
  }

  /**
   * Run multiple benchmark tests.
   */
  async runMultipleTests(
    tests: Array<{ prompt: string; name?: string }>
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const testName = test.name || `test_${i + 1}`;
      const result = await this.runTest(test.prompt, testName);
      results.push(result);
    }

    return results;
  }

  private extractTokenUsage(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    prompt: string,
    response: string
  ): TokenUsage {
    if (completion.usage) {
      return {
        input_tokens: completion.usage.prompt_tokens,
        output_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens,
        method: 'actual',
      };
    }

    // Estimate if not available
    return {
      input_tokens: CostTracker.estimateTokens(prompt),
      output_tokens: CostTracker.estimateTokens(response),
      total_tokens:
        CostTracker.estimateTokens(prompt) +
        CostTracker.estimateTokens(response),
      method: 'estimated',
    };
  }

  private calculateCost(tokenUsage: TokenUsage): CostInfo {
    const pricing = CostTracker.getModelPricing(this.model);
    const inputCost =
      (tokenUsage.input_tokens / 1_000_000) * pricing.input;
    const outputCost =
      (tokenUsage.output_tokens / 1_000_000) * pricing.output;

    return {
      total_usd: Math.round((inputCost + outputCost) * 1000000) / 1000000,
      input_cost_usd: Math.round(inputCost * 1000000) / 1000000,
      output_cost_usd: Math.round(outputCost * 1000000) / 1000000,
      model: this.model,
    };
  }

  private createErrorResult(
    testName: string,
    prompt: string,
    startTime: number,
    error: string,
    attempts: number
  ): TestResult {
    return {
      test_name: testName,
      prompt,
      response: null,
      model: this.model,
      agent_name: this.name,
      execution_time: (Date.now() - startTime) / 1000,
      status: 'error',
      error,
      retry_attempts: attempts,
      timestamp: new Date().toISOString(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

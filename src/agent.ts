/**
 * BenchAgent - Core agent for running benchmarks using Vercel AI SDK
 *
 * Supports multiple providers: OpenAI, Anthropic, Google, xAI, Mistral, Groq
 * Provides LLM interaction with retry logic, token tracking, and cost calculation.
 */

import { generateText } from 'ai';
import { CostTracker, TokenUsage, CostInfo } from './cost-tracker';
import {
  getModelFromString,
  parseModelString,
  ProviderName,
  PROVIDERS,
} from './providers';

export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: ProviderName;
  instructions?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface TestResult {
  test_name: string;
  prompt: string;
  response: string | null;
  model: string;
  provider: ProviderName;
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
 * A multi-provider agent wrapper for running LLM benchmarks.
 * Supports OpenAI, Anthropic, Google, xAI, Mistral, Groq via Vercel AI SDK.
 */
export class BenchAgent {
  private name: string;
  private modelString: string;
  private provider: ProviderName;
  private instructions: string;
  private maxRetries: number;

  constructor(config: AgentConfig = {}) {
    this.name = config.name || 'BenchAgent';
    this.modelString = config.model || 'gpt-4o-mini';
    this.maxRetries = config.maxRetries || 3;

    // Parse model string to get provider
    const parsed = parseModelString(this.modelString);
    this.provider = config.provider || parsed.provider;
    this.modelString = parsed.model;

    this.instructions =
      config.instructions ||
      `You are a helpful AI assistant designed for benchmarking tasks.
Provide clear, accurate, and detailed responses.
Follow instructions precisely and maintain consistency in your responses.`;

    // Validate provider API key
    const providerConfig = PROVIDERS[this.provider];
    if (!process.env[providerConfig.envKey]) {
      console.warn(
        `⚠️  ${providerConfig.envKey} not set. Provider '${this.provider}' may not work.`
      );
    }
  }

  /**
   * Get the model name.
   */
  getModel(): string {
    return this.modelString;
  }

  /**
   * Get the provider name.
   */
  getProvider(): ProviderName {
    return this.provider;
  }

  /**
   * Get the agent name.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get full model identifier (provider/model).
   */
  getFullModelId(): string {
    return `${this.provider}/${this.modelString}`;
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

        // Get the model from provider registry
        const model = getModelFromString(`${this.provider}/${this.modelString}`);

        // Use Vercel AI SDK generateText
        const result = await generateText({
          model,
          system: this.instructions,
          prompt,
        });

        const endTime = Date.now();
        const response = result.text || '';

        // Check for empty response
        if (!response || response.trim().length === 0) {
          const errorMsg = `Agent returned empty response. Check API key for model '${this.modelString}'.`;
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

        // Extract token usage from Vercel AI SDK response
        const tokenUsage = this.extractTokenUsage(result, prompt, response);
        const costInfo = this.calculateCost(tokenUsage);

        const testResult: TestResult = {
          test_name: finalTestName,
          prompt,
          response,
          model: this.modelString,
          provider: this.provider,
          agent_name: this.name,
          execution_time: (endTime - startTime) / 1000,
          status: 'success',
          timestamp: new Date().toISOString(),
          token_usage: tokenUsage,
          cost: costInfo,
        };

        if (attempt > 0) {
          testResult.retry_attempts = attempt + 1;
          console.log(`✅ Succeeded after ${attempt + 1} attempt(s)`);
        }

        return testResult;
      } catch (error) {
        const errorMsg = `Agent '${this.name}' failed with model '${this.provider}/${this.modelString}': ${error instanceof Error ? error.message : String(error)}`;

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
    result: { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } },
    prompt: string,
    response: string
  ): TokenUsage {
    if (result.usage) {
      return {
        input_tokens: result.usage.promptTokens || 0,
        output_tokens: result.usage.completionTokens || 0,
        total_tokens: result.usage.totalTokens || 0,
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
    const pricing = CostTracker.getModelPricing(this.modelString);
    const inputCost =
      (tokenUsage.input_tokens / 1_000_000) * pricing.input;
    const outputCost =
      (tokenUsage.output_tokens / 1_000_000) * pricing.output;

    return {
      total_usd: Math.round((inputCost + outputCost) * 1000000) / 1000000,
      input_cost_usd: Math.round(inputCost * 1000000) / 1000000,
      output_cost_usd: Math.round(outputCost * 1000000) / 1000000,
      model: this.modelString,
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
      model: this.modelString,
      provider: this.provider,
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

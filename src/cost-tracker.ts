/**
 * Cost Tracker - Token usage and cost calculation for LLM benchmarking
 *
 * Pricing data based on official provider pricing (as of December 2024).
 * Prices are per 1M tokens (input/output).
 */

export interface ModelPricing {
  input: number;
  output: number;
}

export interface ModelCostData {
  input_tokens: number;
  output_tokens: number;
  cost: number;
}

export interface CostSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  by_model: Record<string, ModelCostData>;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  method: 'actual' | 'estimated';
}

export interface CostInfo {
  total_usd: number;
  input_cost_usd: number;
  output_cost_usd: number;
  model: string;
}

// Model pricing database (USD per 1M tokens)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-16k': { input: 3.0, output: 4.0 },

  // OpenAI O1 Models
  o1: { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o1-preview': { input: 15.0, output: 60.0 },

  // Anthropic Claude Models
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-opus-latest': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-latest': { input: 0.8, output: 4.0 },

  // Google Gemini Models
  'gemini-2.0-flash-exp': { input: 0.0, output: 0.0 }, // Free during preview
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
  'gemini-pro': { input: 0.5, output: 1.5 },

  // XAI Grok Models
  'grok-beta': { input: 5.0, output: 15.0 },
  'grok-2-1212': { input: 2.0, output: 10.0 },
  'grok-2-vision-1212': { input: 2.0, output: 10.0 },

  // Mistral Models
  'mistral-large-latest': { input: 2.0, output: 6.0 },
  'mistral-medium-latest': { input: 2.7, output: 8.1 },
  'mistral-small-latest': { input: 0.2, output: 0.6 },
  'pixtral-large-latest': { input: 2.0, output: 6.0 },

  // Groq Models (highly optimized pricing)
  'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },
  'gemma2-9b-it': { input: 0.2, output: 0.2 },

  // DeepSeek Models
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },

  // Default fallback pricing
  default: { input: 1.0, output: 3.0 },
};

/**
 * Track token usage and calculate costs for LLM API calls.
 */
export class CostTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCost = 0;
  private modelCosts: Record<string, ModelCostData> = {};

  /**
   * Normalize model name for pricing lookup.
   */
  static normalizeModelName(model: string): string {
    if (!model) return 'default';

    // Remove common prefixes
    let normalized = model;
    if (normalized.startsWith('openai/')) {
      normalized = normalized.replace('openai/', '');
    }
    if (normalized.startsWith('anthropic/')) {
      normalized = normalized.replace('anthropic/', '');
    }

    return normalized;
  }

  /**
   * Get pricing for a specific model.
   */
  static getModelPricing(model: string): ModelPricing {
    const normalized = CostTracker.normalizeModelName(model);

    // Try exact match
    if (MODEL_PRICING[normalized]) {
      return MODEL_PRICING[normalized];
    }

    // Try partial match
    for (const key of Object.keys(MODEL_PRICING)) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return MODEL_PRICING[key];
      }
    }

    return MODEL_PRICING['default'];
  }

  /**
   * Calculate cost for token usage.
   */
  static calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): number {
    const pricing = CostTracker.getModelPricing(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Estimate tokens from text (rough approximation: 1 token ≈ 4 characters).
   */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract token usage from OpenAI API response.
   */
  static extractTokenUsage(
    response: Record<string, unknown>
  ): { input: number; output: number } {
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      if (response.usage) {
        const usage = response.usage as Record<string, number>;
        inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
        outputTokens = usage.completion_tokens || usage.output_tokens || 0;
      }
    } catch {
      // Extraction failed, return zeros
    }

    return { input: inputTokens, output: outputTokens };
  }

  /**
   * Add token usage to tracker.
   */
  addUsage(
    inputTokens: number,
    outputTokens: number,
    model: string,
    cost?: number
  ): void {
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;

    const calculatedCost =
      cost ?? CostTracker.calculateCost(inputTokens, outputTokens, model);
    this.totalCost += calculatedCost;

    if (!this.modelCosts[model]) {
      this.modelCosts[model] = {
        input_tokens: 0,
        output_tokens: 0,
        cost: 0,
      };
    }

    this.modelCosts[model].input_tokens += inputTokens;
    this.modelCosts[model].output_tokens += outputTokens;
    this.modelCosts[model].cost += calculatedCost;
  }

  /**
   * Get cost tracking summary.
   */
  getSummary(): CostSummary {
    return {
      total_input_tokens: this.totalInputTokens,
      total_output_tokens: this.totalOutputTokens,
      total_tokens: this.totalInputTokens + this.totalOutputTokens,
      total_cost_usd: Math.round(this.totalCost * 10000) / 10000,
      by_model: this.modelCosts,
    };
  }

  /**
   * Reset tracker.
   */
  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCost = 0;
    this.modelCosts = {};
  }
}

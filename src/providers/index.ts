/**
 * Provider Registry - Unified interface for multiple LLM providers
 *
 * Supports: OpenAI, Anthropic, Google, xAI, Mistral, Groq, and more via Vercel AI SDK
 */

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { mistral } from '@ai-sdk/mistral';
import { groq } from '@ai-sdk/groq';
import { LanguageModelV1 } from 'ai';

export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'mistral'
  | 'groq';

export interface ProviderConfig {
  name: ProviderName;
  envKey: string;
  defaultModel: string;
  models: string[];
}

// Provider configurations
export const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  openai: {
    name: 'openai',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o1-preview',
    ],
  },
  anthropic: {
    name: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  google: {
    name: 'google',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    defaultModel: 'gemini-1.5-flash',
    models: [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
    ],
  },
  xai: {
    name: 'xai',
    envKey: 'XAI_API_KEY',
    defaultModel: 'grok-beta',
    models: ['grok-beta', 'grok-2-1212', 'grok-2-vision-1212'],
  },
  mistral: {
    name: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    models: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'pixtral-large-latest',
    ],
  },
  groq: {
    name: 'groq',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.1-70b-versatile',
    models: [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
  },
};

/**
 * Parse a model string like "openai/gpt-4o" or just "gpt-4o"
 */
export function parseModelString(modelString: string): {
  provider: ProviderName;
  model: string;
} {
  if (modelString.includes('/')) {
    const [providerName, model] = modelString.split('/');
    const provider = providerName.toLowerCase() as ProviderName;
    if (PROVIDERS[provider]) {
      return { provider, model };
    }
  }

  // Try to detect provider from model name
  const modelLower = modelString.toLowerCase();

  if (
    modelLower.startsWith('gpt-') ||
    modelLower.startsWith('o1') ||
    modelLower === 'chatgpt-4o-latest'
  ) {
    return { provider: 'openai', model: modelString };
  }

  if (modelLower.startsWith('claude')) {
    return { provider: 'anthropic', model: modelString };
  }

  if (modelLower.startsWith('gemini')) {
    return { provider: 'google', model: modelString };
  }

  if (modelLower.startsWith('grok')) {
    return { provider: 'xai', model: modelString };
  }

  if (
    modelLower.startsWith('mistral') ||
    modelLower.startsWith('pixtral')
  ) {
    return { provider: 'mistral', model: modelString };
  }

  if (
    modelLower.startsWith('llama') ||
    modelLower.startsWith('mixtral') ||
    modelLower.startsWith('gemma')
  ) {
    return { provider: 'groq', model: modelString };
  }

  // Default to OpenAI
  return { provider: 'openai', model: modelString };
}

/**
 * Get a model instance from provider and model name
 */
export function getModel(
  providerName: ProviderName,
  modelName: string
): LanguageModelV1 {
  switch (providerName) {
    case 'openai':
      return openai(modelName);
    case 'anthropic':
      return anthropic(modelName);
    case 'google':
      return google(modelName);
    case 'xai':
      return xai(modelName);
    case 'mistral':
      return mistral(modelName);
    case 'groq':
      return groq(modelName);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * Get model from a model string like "openai/gpt-4o" or "gpt-4o-mini"
 */
export function getModelFromString(modelString: string): LanguageModelV1 {
  const { provider, model } = parseModelString(modelString);
  return getModel(provider, model);
}

/**
 * Check if a provider's API key is configured
 */
export function isProviderConfigured(providerName: ProviderName): boolean {
  const config = PROVIDERS[providerName];
  return !!process.env[config.envKey];
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(): ProviderName[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).filter(
    isProviderConfigured
  );
}

/**
 * Get all available providers
 */
export function getAllProviders(): ProviderName[] {
  return Object.keys(PROVIDERS) as ProviderName[];
}

/**
 * Get provider configuration
 */
export function getProviderConfig(
  providerName: ProviderName
): ProviderConfig | undefined {
  return PROVIDERS[providerName];
}

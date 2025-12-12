/**
 * Tests for the Provider Registry
 */

import {
  parseModelString,
  getProviderConfig,
  getAllProviders,
  isProviderConfigured,
  PROVIDERS,
} from '../src/providers';

describe('Provider Registry', () => {
  describe('parseModelString', () => {
    it('should parse provider/model format', () => {
      const result = parseModelString('openai/gpt-4o');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
    });

    it('should parse anthropic/model format', () => {
      const result = parseModelString('anthropic/claude-3-5-sonnet-latest');
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-5-sonnet-latest');
    });

    it('should detect OpenAI models without prefix', () => {
      expect(parseModelString('gpt-4o').provider).toBe('openai');
      expect(parseModelString('gpt-4o-mini').provider).toBe('openai');
      expect(parseModelString('gpt-3.5-turbo').provider).toBe('openai');
      expect(parseModelString('o1').provider).toBe('openai');
      expect(parseModelString('o1-mini').provider).toBe('openai');
    });

    it('should detect Anthropic models without prefix', () => {
      expect(parseModelString('claude-3-5-sonnet-latest').provider).toBe('anthropic');
      expect(parseModelString('claude-3-opus-latest').provider).toBe('anthropic');
    });

    it('should detect Google models without prefix', () => {
      expect(parseModelString('gemini-1.5-flash').provider).toBe('google');
      expect(parseModelString('gemini-1.5-pro').provider).toBe('google');
    });

    it('should detect xAI models without prefix', () => {
      expect(parseModelString('grok-beta').provider).toBe('xai');
      expect(parseModelString('grok-2-1212').provider).toBe('xai');
    });

    it('should detect Mistral models without prefix', () => {
      expect(parseModelString('mistral-large-latest').provider).toBe('mistral');
      expect(parseModelString('pixtral-large-latest').provider).toBe('mistral');
    });

    it('should detect Groq models without prefix', () => {
      expect(parseModelString('llama-3.1-70b-versatile').provider).toBe('groq');
      expect(parseModelString('mixtral-8x7b-32768').provider).toBe('groq');
    });

    it('should default to OpenAI for unknown models', () => {
      expect(parseModelString('unknown-model').provider).toBe('openai');
    });
  });

  describe('getProviderConfig', () => {
    it('should return config for openai', () => {
      const config = getProviderConfig('openai');
      expect(config).toBeDefined();
      expect(config?.envKey).toBe('OPENAI_API_KEY');
      expect(config?.defaultModel).toBe('gpt-4o-mini');
    });

    it('should return config for anthropic', () => {
      const config = getProviderConfig('anthropic');
      expect(config).toBeDefined();
      expect(config?.envKey).toBe('ANTHROPIC_API_KEY');
    });

    it('should return config for google', () => {
      const config = getProviderConfig('google');
      expect(config).toBeDefined();
      expect(config?.envKey).toBe('GOOGLE_GENERATIVE_AI_API_KEY');
    });
  });

  describe('getAllProviders', () => {
    it('should return all provider names', () => {
      const providers = getAllProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).toContain('xai');
      expect(providers).toContain('mistral');
      expect(providers).toContain('groq');
    });
  });

  describe('PROVIDERS', () => {
    it('should have models array for each provider', () => {
      for (const provider of getAllProviders()) {
        expect(PROVIDERS[provider].models).toBeDefined();
        expect(PROVIDERS[provider].models.length).toBeGreaterThan(0);
      }
    });

    it('should have envKey for each provider', () => {
      for (const provider of getAllProviders()) {
        expect(PROVIDERS[provider].envKey).toBeDefined();
        expect(PROVIDERS[provider].envKey.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isProviderConfigured', () => {
    it('should return false when env var not set', () => {
      // Save and clear env var
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      expect(isProviderConfigured('openai')).toBe(false);

      // Restore
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('should return true when env var is set', () => {
      // Set env var
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-key';

      expect(isProviderConfigured('openai')).toBe(true);

      // Restore
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });
  });
});

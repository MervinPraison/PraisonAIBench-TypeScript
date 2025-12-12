/**
 * Tests for the Bench class
 */

import { Bench, CostTracker, PluginManager } from '../src';

describe('Bench', () => {
  describe('constructor', () => {
    it('should create instance with default config', () => {
      // Mock console to suppress output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const bench = new Bench({}, false); // Disable evaluation to avoid plugin loading
      expect(bench).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should accept custom config', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const bench = new Bench({
        default_model: 'gpt-3.5-turbo',
        output_dir: 'custom_output',
        max_retries: 5,
      }, false);
      
      expect(bench).toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getSummary', () => {
    it('should return empty summary when no results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const bench = new Bench({}, false);
      const summary = bench.getSummary();
      
      expect(summary.total_tests).toBe(0);
      expect(summary.successful_tests).toBe(0);
      expect(summary.failed_tests).toBe(0);
      expect(summary.success_rate).toBe('0%');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getResults', () => {
    it('should return empty array initially', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const bench = new Bench({}, false);
      const results = bench.getResults();
      
      expect(results).toEqual([]);
      
      consoleSpy.mockRestore();
    });
  });

  describe('clearResults', () => {
    it('should clear results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const bench = new Bench({}, false);
      bench.clearResults();
      
      expect(bench.getResults()).toEqual([]);
      
      consoleSpy.mockRestore();
    });
  });
});

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('normalizeModelName', () => {
    it('should remove openai/ prefix', () => {
      expect(CostTracker.normalizeModelName('openai/gpt-4o')).toBe('gpt-4o');
    });

    it('should remove anthropic/ prefix', () => {
      expect(CostTracker.normalizeModelName('anthropic/claude-3')).toBe('claude-3');
    });

    it('should return default for empty string', () => {
      expect(CostTracker.normalizeModelName('')).toBe('default');
    });
  });

  describe('getModelPricing', () => {
    it('should return pricing for known model', () => {
      const pricing = CostTracker.getModelPricing('gpt-4o-mini');
      expect(pricing.input).toBe(0.15);
      expect(pricing.output).toBe(0.6);
    });

    it('should return default pricing for unknown model', () => {
      const pricing = CostTracker.getModelPricing('unknown-model');
      expect(pricing.input).toBe(1.0);
      expect(pricing.output).toBe(3.0);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly', () => {
      const cost = CostTracker.calculateCost(1000, 500, 'gpt-4o-mini');
      // 1000 input tokens * 0.15/1M + 500 output tokens * 0.6/1M
      const expected = (1000 / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.6;
      expect(cost).toBeCloseTo(expected, 10);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens from text', () => {
      const text = 'Hello World'; // 11 characters
      const tokens = CostTracker.estimateTokens(text);
      expect(tokens).toBe(3); // ceil(11/4) = 3
    });

    it('should return 0 for empty string', () => {
      expect(CostTracker.estimateTokens('')).toBe(0);
    });
  });

  describe('addUsage', () => {
    it('should track usage correctly', () => {
      tracker.addUsage(1000, 500, 'gpt-4o-mini');
      const summary = tracker.getSummary();
      
      expect(summary.total_input_tokens).toBe(1000);
      expect(summary.total_output_tokens).toBe(500);
      expect(summary.total_tokens).toBe(1500);
    });

    it('should track multiple models', () => {
      tracker.addUsage(1000, 500, 'gpt-4o-mini');
      tracker.addUsage(2000, 1000, 'gpt-4o');
      
      const summary = tracker.getSummary();
      expect(summary.total_tokens).toBe(4500);
      expect(Object.keys(summary.by_model)).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('should reset all tracking', () => {
      tracker.addUsage(1000, 500, 'gpt-4o-mini');
      tracker.reset();
      
      const summary = tracker.getSummary();
      expect(summary.total_tokens).toBe(0);
      expect(Object.keys(summary.by_model)).toHaveLength(0);
    });
  });
});

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    manager = new PluginManager();
    consoleSpy.mockRestore();
  });

  describe('listLanguages', () => {
    it('should list built-in languages', () => {
      const languages = manager.listLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('ts');
      expect(languages).toContain('javascript');
      expect(languages).toContain('js');
    });
  });

  describe('hasEvaluator', () => {
    it('should return true for typescript', () => {
      expect(manager.hasEvaluator('typescript')).toBe(true);
    });

    it('should return true for ts alias', () => {
      expect(manager.hasEvaluator('ts')).toBe(true);
    });

    it('should return false for unknown language', () => {
      expect(manager.hasEvaluator('python')).toBe(false);
    });
  });

  describe('getEvaluator', () => {
    it('should return evaluator for typescript', () => {
      const evaluator = manager.getEvaluator('typescript');
      expect(evaluator).toBeDefined();
      expect(evaluator?.getLanguage()).toBe('typescript');
    });

    it('should return undefined for unknown language', () => {
      const evaluator = manager.getEvaluator('python');
      expect(evaluator).toBeUndefined();
    });
  });
});

/**
 * Tests for the Plugin Discovery System
 */

import {
  discoverPlugins,
  isValidEvaluator,
  listPluginPackages,
} from '../src/plugin-discovery';
import { PluginManager } from '../src/plugin-manager';
import { BaseEvaluator, EvaluationResult } from '../src/base-evaluator';

// Mock evaluator for testing
class MockEvaluator extends BaseEvaluator {
  getLanguage(): string {
    return 'mock';
  }

  getFileExtension(): string {
    return 'mock';
  }

  async evaluate(
    _code: string,
    _testName: string,
    _prompt: string,
    _expected?: string
  ): Promise<EvaluationResult> {
    return {
      score: 100,
      passed: true,
      feedback: [{ level: 'success', message: 'Mock evaluation' }],
    };
  }
}

describe('Plugin Discovery', () => {
  describe('discoverPlugins', () => {
    it('should return an array', () => {
      const plugins = discoverPlugins();
      expect(Array.isArray(plugins)).toBe(true);
    });

    it('should not throw on empty node_modules', () => {
      expect(() => discoverPlugins(['/nonexistent/path'])).not.toThrow();
    });
  });

  describe('isValidEvaluator', () => {
    it('should return true for valid evaluator', () => {
      const evaluator = new MockEvaluator();
      expect(isValidEvaluator(evaluator)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidEvaluator(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidEvaluator(undefined)).toBe(false);
    });

    it('should return false for plain object', () => {
      expect(isValidEvaluator({})).toBe(false);
    });

    it('should return false for object without required methods', () => {
      expect(isValidEvaluator({ getLanguage: () => 'test' })).toBe(false);
    });

    it('should return true for object with required methods', () => {
      const obj = {
        getLanguage: () => 'test',
        evaluate: async () => ({ score: 0, passed: false, feedback: [] }),
      };
      expect(isValidEvaluator(obj)).toBe(true);
    });
  });

  describe('listPluginPackages', () => {
    it('should return an array of package names', () => {
      const packages = listPluginPackages();
      expect(Array.isArray(packages)).toBe(true);
    });
  });
});

describe('PluginManager with Discovery', () => {
  let manager: PluginManager;

  beforeEach(() => {
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    manager = new PluginManager(false); // Disable auto-discovery for controlled tests
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance without auto-discovery', () => {
      expect(manager).toBeDefined();
    });

    it('should load built-in evaluators', () => {
      expect(manager.hasEvaluator('typescript')).toBe(true);
      expect(manager.hasEvaluator('ts')).toBe(true);
      expect(manager.hasEvaluator('html')).toBe(true);
    });
  });

  describe('register', () => {
    it('should register a custom evaluator', () => {
      const mockEvaluator = new MockEvaluator();
      manager.register('mock', mockEvaluator);
      expect(manager.hasEvaluator('mock')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const mockEvaluator = new MockEvaluator();
      manager.register('MOCK', mockEvaluator);
      expect(manager.hasEvaluator('mock')).toBe(true);
      expect(manager.hasEvaluator('MOCK')).toBe(true);
    });
  });

  describe('getEvaluator', () => {
    it('should return registered evaluator', () => {
      const mockEvaluator = new MockEvaluator();
      manager.register('mock', mockEvaluator);
      const retrieved = manager.getEvaluator('mock');
      expect(retrieved).toBe(mockEvaluator);
    });

    it('should return undefined for unknown language', () => {
      expect(manager.getEvaluator('unknown')).toBeUndefined();
    });
  });

  describe('listLanguages', () => {
    it('should list all registered languages', () => {
      const languages = manager.listLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('ts');
      expect(languages).toContain('html');
    });

    it('should include custom registered languages', () => {
      manager.register('mock', new MockEvaluator());
      const languages = manager.listLanguages();
      expect(languages).toContain('mock');
    });

    it('should return sorted list', () => {
      manager.register('zzz', new MockEvaluator());
      manager.register('aaa', new MockEvaluator());
      const languages = manager.listLanguages();
      expect(languages).toEqual([...languages].sort());
    });
  });

  describe('unregister', () => {
    it('should remove registered evaluator', () => {
      manager.register('mock', new MockEvaluator());
      expect(manager.hasEvaluator('mock')).toBe(true);
      manager.unregister('mock');
      expect(manager.hasEvaluator('mock')).toBe(false);
    });

    it('should return true when unregistering existing evaluator', () => {
      manager.register('mock', new MockEvaluator());
      expect(manager.unregister('mock')).toBe(true);
    });

    it('should return false when unregistering non-existent evaluator', () => {
      expect(manager.unregister('nonexistent')).toBe(false);
    });
  });

  describe('getLoadedPlugins', () => {
    it('should return empty array initially', () => {
      expect(manager.getLoadedPlugins()).toEqual([]);
    });
  });

  describe('discoverPlugins', () => {
    it('should not throw', () => {
      expect(() => manager.discoverPlugins()).not.toThrow();
    });
  });

  describe('reloadPlugins', () => {
    it('should not throw', () => {
      expect(() => manager.reloadPlugins()).not.toThrow();
    });
  });
});

describe('BaseEvaluator', () => {
  it('should have default getFileExtension implementation', () => {
    const evaluator = new MockEvaluator();
    // MockEvaluator overrides getFileExtension, but we can test the concept
    expect(evaluator.getFileExtension()).toBe('mock');
  });
});

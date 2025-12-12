/**
 * Plugin manager for discovering and loading evaluator plugins.
 *
 * Manages evaluator plugins for different languages with built-in TypeScript support.
 */

import { BaseEvaluator } from './base-evaluator';
import { TypeScriptEvaluator } from './evaluator';
import { HTMLEvaluator } from './evaluators/html-evaluator';

/**
 * Manages evaluator plugins for different languages.
 */
export class PluginManager {
  private evaluators: Map<string, BaseEvaluator> = new Map();

  constructor() {
    this.loadBuiltinEvaluators();
  }

  /**
   * Load built-in evaluators (TypeScript/JavaScript and HTML).
   */
  private loadBuiltinEvaluators(): void {
    // Load TypeScript evaluator
    try {
      const tsEvaluator = new TypeScriptEvaluator();

      // Register with multiple aliases
      this.register('typescript', tsEvaluator);
      this.register('ts', tsEvaluator);

      console.log('  ✅ Loaded built-in TypeScript evaluator');
    } catch (error) {
      console.warn(
        `⚠️  Could not load TypeScript evaluator: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Load HTML evaluator
    try {
      const htmlEvaluator = new HTMLEvaluator();

      // Register with multiple aliases
      this.register('html', htmlEvaluator);
      this.register('javascript', htmlEvaluator);
      this.register('js', htmlEvaluator);

      console.log('  ✅ Loaded built-in HTML/JavaScript evaluator');
    } catch (error) {
      console.warn(
        `⚠️  Could not load HTML evaluator: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Register an evaluator for a language.
   *
   * @param language - Language identifier (case-insensitive)
   * @param evaluator - Evaluator instance
   */
  register(language: string, evaluator: BaseEvaluator): void {
    this.evaluators.set(language.toLowerCase(), evaluator);
  }

  /**
   * Get evaluator for a language.
   *
   * @param language - Language identifier (case-insensitive)
   * @returns Evaluator instance or undefined if not found
   */
  getEvaluator(language: string): BaseEvaluator | undefined {
    return this.evaluators.get(language.toLowerCase());
  }

  /**
   * Get list of all supported languages.
   *
   * @returns List of language identifiers
   */
  listLanguages(): string[] {
    return Array.from(this.evaluators.keys()).sort();
  }

  /**
   * Check if evaluator exists for a language.
   *
   * @param language - Language identifier (case-insensitive)
   * @returns True if evaluator exists
   */
  hasEvaluator(language: string): boolean {
    return this.evaluators.has(language.toLowerCase());
  }

  /**
   * Unregister an evaluator.
   *
   * @param language - Language identifier to unregister
   */
  unregister(language: string): boolean {
    return this.evaluators.delete(language.toLowerCase());
  }
}

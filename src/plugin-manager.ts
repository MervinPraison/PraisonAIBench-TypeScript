/**
 * Plugin manager for discovering and loading evaluator plugins.
 *
 * Supports:
 * 1. Built-in evaluators (TypeScript, HTML)
 * 2. External plugins via npm packages with praisonaibench.evaluators field
 * 3. Programmatic registration via register() method
 *
 * External plugins should declare evaluators in package.json:
 * ```json
 * {
 *   "praisonaibench": {
 *     "evaluators": {
 *       "python": "./dist/evaluator.js"
 *     }
 *   }
 * }
 * ```
 */

import { BaseEvaluator } from './base-evaluator';
import { TypeScriptEvaluator } from './evaluator';
import { HTMLEvaluator } from './evaluators/html-evaluator';
import {
  discoverPlugins,
  loadEvaluatorClass,
  isValidEvaluator,
  PluginInfo,
} from './plugin-discovery';

export interface LoadedPlugin {
  language: string;
  packageName: string;
  evaluator: BaseEvaluator;
}

/**
 * Manages evaluator plugins for different languages.
 *
 * Automatically discovers and loads plugins from:
 * 1. Built-in evaluators (TypeScript, HTML)
 * 2. npm packages with praisonaibench.evaluators in package.json
 */
export class PluginManager {
  private evaluators: Map<string, BaseEvaluator> = new Map();
  private loadedPlugins: LoadedPlugin[] = [];

  constructor(autoDiscover = true) {
    this.loadBuiltinEvaluators();
    if (autoDiscover) {
      this.discoverPlugins();
    }
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

      console.log('  ✅ Loaded built-in HTML evaluator');
    } catch (error) {
      console.warn(
        `⚠️  Could not load HTML evaluator: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Discover and load plugins from npm packages.
   *
   * Scans node_modules for packages with praisonaibench.evaluators field.
   */
  discoverPlugins(): void {
    try {
      const plugins = discoverPlugins();
      let loadedCount = 0;

      for (const plugin of plugins) {
        const loaded = this.loadPlugin(plugin);
        if (loaded) {
          loadedCount++;
        }
      }

      if (loadedCount > 0) {
        console.log(`  ✅ Loaded ${loadedCount} external plugin(s)`);
      }
    } catch (error) {
      console.warn(
        `⚠️  Plugin discovery failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load a single plugin from plugin info.
   */
  private loadPlugin(plugin: PluginInfo): boolean {
    try {
      const EvaluatorClass = loadEvaluatorClass(plugin);
      if (!EvaluatorClass) {
        return false;
      }

      const evaluator = new EvaluatorClass();

      if (!isValidEvaluator(evaluator)) {
        console.warn(
          `⚠️  Plugin ${plugin.packageName}: Evaluator does not implement required methods`
        );
        return false;
      }

      // Get the language from the evaluator
      const language = evaluator.getLanguage().toLowerCase();

      // Register the evaluator
      this.register(language, evaluator);

      // Track loaded plugin
      this.loadedPlugins.push({
        language,
        packageName: plugin.packageName,
        evaluator,
      });

      console.log(`  ✅ Loaded plugin: ${language} (from ${plugin.packageName})`);
      return true;
    } catch (error) {
      console.warn(
        `⚠️  Failed to load plugin ${plugin.packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Load a plugin from a specific npm package.
   *
   * @param packageName - Name of the npm package
   * @returns True if plugin was loaded successfully
   */
  loadPluginFromPackage(packageName: string): boolean {
    try {
      // Try to require the package
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require(`${packageName}/package.json`);

      if (!pkg.praisonaibench?.evaluators) {
        console.warn(`⚠️  Package ${packageName} has no praisonaibench.evaluators field`);
        return false;
      }

      let loaded = false;
      for (const [language, evaluatorPath] of Object.entries(
        pkg.praisonaibench.evaluators as Record<string, string>
      )) {
        const plugin: PluginInfo = {
          packageName,
          language,
          evaluatorPath: require.resolve(`${packageName}/${evaluatorPath}`),
        };

        if (this.loadPlugin(plugin)) {
          loaded = true;
        }
      }

      return loaded;
    } catch (error) {
      console.warn(
        `⚠️  Failed to load plugin from ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
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

  /**
   * Get list of loaded external plugins.
   */
  getLoadedPlugins(): LoadedPlugin[] {
    return [...this.loadedPlugins];
  }

  /**
   * Get plugin info for a specific language.
   */
  getPluginInfo(language: string): LoadedPlugin | undefined {
    return this.loadedPlugins.find(
      (p) => p.language === language.toLowerCase()
    );
  }

  /**
   * Reload all plugins (useful for development).
   */
  reloadPlugins(): void {
    // Clear external plugins
    for (const plugin of this.loadedPlugins) {
      this.evaluators.delete(plugin.language);
    }
    this.loadedPlugins = [];

    // Re-discover plugins
    this.discoverPlugins();
  }
}

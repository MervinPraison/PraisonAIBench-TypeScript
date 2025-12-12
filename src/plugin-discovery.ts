/**
 * Plugin Discovery - Automatic discovery of evaluator plugins from npm packages
 *
 * Scans node_modules for packages that declare evaluators in their package.json:
 *
 * ```json
 * {
 *   "name": "praisonaibench-python",
 *   "praisonaibench": {
 *     "evaluators": {
 *       "python": "./dist/evaluator.js"
 *     }
 *   }
 * }
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseEvaluator } from './base-evaluator';

export interface PluginInfo {
  packageName: string;
  language: string;
  evaluatorPath: string;
  evaluatorClass?: new () => BaseEvaluator;
}

export interface PluginPackageJson {
  name: string;
  praisonaibench?: {
    evaluators?: Record<string, string>;
  };
}

/**
 * Discover evaluator plugins from installed npm packages.
 *
 * Looks for packages with a "praisonaibench.evaluators" field in package.json.
 *
 * @param searchPaths - Additional paths to search for node_modules
 * @returns Array of discovered plugin information
 */
export function discoverPlugins(searchPaths: string[] = []): PluginInfo[] {
  const plugins: PluginInfo[] = [];
  const nodeModulesPaths = getNodeModulesPaths(searchPaths);

  for (const nodeModulesPath of nodeModulesPaths) {
    if (!fs.existsSync(nodeModulesPath)) {
      continue;
    }

    try {
      const packages = fs.readdirSync(nodeModulesPath);

      for (const packageName of packages) {
        // Skip hidden files and scoped package directories
        if (packageName.startsWith('.')) {
          continue;
        }

        // Handle scoped packages (@org/package)
        if (packageName.startsWith('@')) {
          const scopedPath = path.join(nodeModulesPath, packageName);
          if (fs.statSync(scopedPath).isDirectory()) {
            const scopedPackages = fs.readdirSync(scopedPath);
            for (const scopedPkg of scopedPackages) {
              const fullPackageName = `${packageName}/${scopedPkg}`;
              const packagePath = path.join(scopedPath, scopedPkg);
              const discovered = discoverPluginFromPackage(
                packagePath,
                fullPackageName
              );
              plugins.push(...discovered);
            }
          }
          continue;
        }

        const packagePath = path.join(nodeModulesPath, packageName);
        const discovered = discoverPluginFromPackage(packagePath, packageName);
        plugins.push(...discovered);
      }
    } catch (error) {
      // Silently ignore errors reading node_modules
    }
  }

  return plugins;
}

/**
 * Discover plugins from a single package directory.
 */
function discoverPluginFromPackage(
  packagePath: string,
  packageName: string
): PluginInfo[] {
  const plugins: PluginInfo[] = [];
  const packageJsonPath = path.join(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return plugins;
  }

  try {
    const packageJson: PluginPackageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf-8')
    );

    // Check for praisonaibench.evaluators field
    if (packageJson.praisonaibench?.evaluators) {
      const evaluators = packageJson.praisonaibench.evaluators;

      for (const [language, evaluatorPath] of Object.entries(evaluators)) {
        const fullPath = path.resolve(packagePath, evaluatorPath);

        plugins.push({
          packageName,
          language: language.toLowerCase(),
          evaluatorPath: fullPath,
        });
      }
    }
  } catch (error) {
    // Silently ignore packages with invalid package.json
  }

  return plugins;
}

/**
 * Get all node_modules paths to search.
 */
function getNodeModulesPaths(additionalPaths: string[] = []): string[] {
  const paths: string[] = [];

  // Current working directory
  paths.push(path.join(process.cwd(), 'node_modules'));

  // Parent directories (for monorepos)
  let currentDir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
    const nodeModulesPath = path.join(currentDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      paths.push(nodeModulesPath);
    }
  }

  // Global node_modules (if NODE_PATH is set)
  if (process.env.NODE_PATH) {
    paths.push(...process.env.NODE_PATH.split(path.delimiter));
  }

  // Additional search paths
  paths.push(...additionalPaths);

  // Remove duplicates
  return [...new Set(paths)];
}

/**
 * Load an evaluator class from a plugin.
 *
 * @param plugin - Plugin information
 * @returns The evaluator class constructor, or undefined if loading fails
 */
export function loadEvaluatorClass(
  plugin: PluginInfo
): (new () => BaseEvaluator) | undefined {
  try {
    // Try to require the module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require(plugin.evaluatorPath);

    // Look for the evaluator class
    // Try common export patterns
    const EvaluatorClass =
      module.default ||
      module[`${capitalize(plugin.language)}Evaluator`] ||
      module.Evaluator ||
      Object.values(module).find(
        (exp) =>
          typeof exp === 'function' &&
          exp.prototype &&
          typeof exp.prototype.getLanguage === 'function' &&
          typeof exp.prototype.evaluate === 'function'
      );

    if (!EvaluatorClass) {
      console.warn(
        `⚠️  Plugin ${plugin.packageName}: No evaluator class found in ${plugin.evaluatorPath}`
      );
      return undefined;
    }

    return EvaluatorClass as new () => BaseEvaluator;
  } catch (error) {
    console.warn(
      `⚠️  Plugin ${plugin.packageName}: Failed to load ${plugin.evaluatorPath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

/**
 * Validate that an object is a valid evaluator instance.
 */
export function isValidEvaluator(obj: unknown): obj is BaseEvaluator {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const evaluator = obj as Record<string, unknown>;

  return (
    typeof evaluator.getLanguage === 'function' &&
    typeof evaluator.evaluate === 'function'
  );
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get plugin info for a specific package by name.
 */
export function getPluginInfo(packageName: string): PluginInfo[] {
  const plugins = discoverPlugins();
  return plugins.filter((p) => p.packageName === packageName);
}

/**
 * List all discovered plugin packages.
 */
export function listPluginPackages(): string[] {
  const plugins = discoverPlugins();
  return [...new Set(plugins.map((p) => p.packageName))];
}

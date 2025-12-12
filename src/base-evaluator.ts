/**
 * Base evaluator interface for language-specific evaluation plugins.
 *
 * This enables developers to create evaluators for any language (Python, TypeScript,
 * Go, Rust, etc.) by implementing the required methods.
 */

export interface FeedbackItem {
  level: 'success' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}

export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: FeedbackItem[];
  details?: Record<string, unknown>;
  overall_score?: number;
}

/**
 * Abstract base class for all language evaluators.
 *
 * Plugin developers: extend this class and implement the required methods.
 *
 * @example
 * ```typescript
 * class PythonEvaluator extends BaseEvaluator {
 *   getLanguage(): string {
 *     return 'python';
 *   }
 *
 *   async evaluate(code, testName, prompt, expected): Promise<EvaluationResult> {
 *     // Your evaluation logic
 *     return { score: 85, passed: true, feedback: [...] };
 *   }
 * }
 * ```
 */
export abstract class BaseEvaluator {
  /**
   * Return the language/type this evaluator handles.
   *
   * @returns Language identifier (lowercase). Examples:
   * - 'python'
   * - 'typescript'
   * - 'go'
   * - 'rust'
   * - 'java'
   * - 'html'
   */
  abstract getLanguage(): string;

  /**
   * Evaluate generated code and return assessment.
   *
   * @param code - The generated code to evaluate
   * @param testName - Name of the test being run
   * @param prompt - Original prompt/requirement from test suite
   * @param expected - Optional expected output for comparison
   *
   * @returns Evaluation result with score, passed status, feedback, and details
   */
  abstract evaluate(
    code: string,
    testName: string,
    prompt: string,
    expected?: string
  ): Promise<EvaluationResult>;

  /**
   * Return file extension for saving code.
   *
   * Override this if extension differs from language name.
   * Default: returns the language name (e.g., 'python' -> .python)
   *
   * @example
   * - 'py' for Python
   * - 'ts' for TypeScript
   * - 'go' for Go
   * - 'html' for HTML
   */
  getFileExtension(): string {
    return this.getLanguage();
  }
}

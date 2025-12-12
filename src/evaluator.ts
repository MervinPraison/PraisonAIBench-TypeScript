/**
 * TypeScript Code Evaluator for PraisonAI Bench
 *
 * Evaluates TypeScript code through multiple stages:
 * 1. Syntax validation (30 points)
 * 2. Code execution (40 points)
 * 3. Output comparison with expected results (30 points if provided)
 *
 * Uses secure subprocess execution with timeout and resource limits.
 */

import * as ts from 'typescript';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Feedback item structure
 */
export interface FeedbackItem {
  level: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

/**
 * Score breakdown structure
 */
export interface ScoreBreakdown {
  syntax: number;
  execution: number;
  output_match: number;
}

/**
 * Evaluation details structure
 */
export interface EvaluationDetails {
  extracted_code: string;
  executed?: boolean;
  output?: string;
  error?: string | null;
  syntax_error?: string;
  similarity?: number;
  expected?: string;
  score_breakdown?: ScoreBreakdown;
}

/**
 * Evaluation result structure
 */
export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: FeedbackItem[];
  details: EvaluationDetails;
}

/**
 * Syntax validation result
 */
interface SyntaxValidationResult {
  isValid: boolean;
  error: string | null;
  details: {
    imports: string[];
  };
}

/**
 * Execution result
 */
interface ExecutionResult {
  success: boolean;
  output: string | null;
  error: string | null;
}

/**
 * Comprehensive TypeScript code evaluator.
 *
 * Features:
 * - Syntax validation using TypeScript compiler API
 * - Secure code execution in subprocess via ts-node
 * - Output comparison with fuzzy matching
 * - Import detection
 * - Timeout protection (5 seconds default)
 *
 * @example
 * ```typescript
 * const evaluator = new TypeScriptEvaluator();
 * const result = evaluator.evaluate(
 *   'console.log("Hello World")',
 *   "hello_world",
 *   "Write TypeScript code that prints Hello World",
 *   "Hello World"
 * );
 * ```
 */
export class TypeScriptEvaluator {
  private timeout: number;
  private tsNodePath: string | null;

  /**
   * Initialise the TypeScript evaluator.
   *
   * @param timeout - Maximum execution time in seconds (default: 5)
   * @param tsNodePath - Path to ts-node executable (default: uses npx)
   */
  constructor(timeout: number = 5, tsNodePath: string | null = null) {
    this.timeout = timeout;
    this.tsNodePath = tsNodePath;
  }

  /**
   * Return language identifier
   */
  getLanguage(): string {
    return 'typescript';
  }

  /**
   * Return file extension for TypeScript files
   */
  getFileExtension(): string {
    return 'ts';
  }

  /**
   * Evaluate TypeScript code comprehensively.
   *
   * Scoring:
   * - Syntax validation: 30 points
   * - Successful execution: 40 points
   * - Output matches expected: 30 points (if expected provided)
   *
   * @param code - TypeScript code to evaluate
   * @param testName - Name of the test
   * @param prompt - Original prompt/requirement
   * @param expected - Expected output (optional)
   * @returns Evaluation result with score, passed status, feedback, and details
   */
  async evaluate(
    code: string,
    _testName: string,
    _prompt: string,
    expected?: string
  ): Promise<EvaluationResult> {
    let score = 0;
    const feedback: FeedbackItem[] = [];
    const details: EvaluationDetails = { extracted_code: '' };

    // Extract code from markdown if present
    const extractedCode = this.extractCode(code);
    details.extracted_code = extractedCode;

    // Stage 1: Syntax Validation (30 points)
    const syntaxResult = this.validateSyntax(extractedCode);
    if (syntaxResult.isValid) {
      score += 30;
      feedback.push({
        level: 'success',
        message: '✅ Valid TypeScript syntax',
      });
      if (syntaxResult.details.imports.length > 0) {
        feedback.push({
          level: 'info',
          message: `📦 Imports: ${syntaxResult.details.imports.join(', ')}`,
        });
      }
    } else {
      feedback.push({
        level: 'error',
        message: `❌ Syntax error: ${syntaxResult.error}`,
      });
      details.syntax_error = syntaxResult.error || undefined;
      return {
        score,
        passed: false,
        feedback,
        details,
      };
    }

    // Stage 2: Code Execution (40 points)
    const executionResult = await this.executeCode(extractedCode);
    details.executed = executionResult.success;
    details.output = executionResult.output || '';
    details.error = executionResult.error;

    if (executionResult.success) {
      score += 40;
      feedback.push({
        level: 'success',
        message: '✅ Code executed successfully',
      });
      if (executionResult.output) {
        const truncatedOutput =
          executionResult.output.length > 100
            ? executionResult.output.substring(0, 100) + '...'
            : executionResult.output;
        feedback.push({
          level: 'info',
          message: `📤 Output: ${truncatedOutput}`,
        });
      }
    } else {
      feedback.push({
        level: 'error',
        message: `❌ Runtime error: ${executionResult.error}`,
      });
    }

    // Stage 3: Output Comparison (30 points if expected provided)
    let matchScore = 0;
    if (expected && executionResult.success) {
      const [outputScore, similarity] = this.compareOutput(
        executionResult.output || '',
        expected
      );
      matchScore = outputScore;
      score += matchScore;
      details.similarity = similarity;
      details.expected = expected;

      if (matchScore >= 25) {
        feedback.push({
          level: 'success',
          message: `✅ Output matches expected (${Math.round(similarity * 100)}% similarity)`,
        });
      } else if (matchScore >= 15) {
        feedback.push({
          level: 'warning',
          message: `⚠️  Output partially matches expected (${Math.round(similarity * 100)}% similarity)`,
        });
      } else {
        feedback.push({
          level: 'warning',
          message: `⚠️  Output differs from expected (${Math.round(similarity * 100)}% similarity)`,
        });
        const truncatedExpected =
          expected.length > 50 ? expected.substring(0, 50) + '...' : expected;
        feedback.push({
          level: 'info',
          message: `Expected: ${truncatedExpected}`,
        });
      }
    } else if (expected && !executionResult.success) {
      feedback.push({
        level: 'error',
        message: '❌ Cannot compare output - code did not execute',
      });
    }

    // Final assessment
    const passed = score >= 70;
    details.score_breakdown = {
      syntax: syntaxResult.isValid ? 30 : 0,
      execution: executionResult.success ? 40 : 0,
      output_match: expected && executionResult.success ? matchScore : 0,
    };

    return {
      score: Math.min(score, 100),
      passed,
      feedback,
      details,
    };
  }

  /**
   * Extract TypeScript code from markdown code blocks.
   *
   * Supports:
   * - ```typescript ... ```
   * - ```ts ... ```
   * - ``` ... ```
   * - Raw TypeScript code
   */
  extractCode(response: string): string {
    const patterns = [
      /```typescript\s*\n([\s\S]*?)\n```/,
      /```ts\s*\n([\s\S]*?)\n```/,
      /```\s*\n([\s\S]*?)\n```/,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return response.trim();
  }

  /**
   * Validate TypeScript syntax using the TypeScript compiler API.
   *
   * @returns Validation result with isValid, error message, and details
   */
  validateSyntax(code: string): SyntaxValidationResult {
    const details = { imports: [] as string[] };

    try {
      // Create a source file from the code
      const sourceFile = ts.createSourceFile(
        'temp.ts',
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );

      // Check for syntax errors using diagnostics
      const compilerOptions: ts.CompilerOptions = {
        noEmit: true,
        allowJs: true,
        checkJs: false,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        strict: false,
        skipLibCheck: true,
        noImplicitAny: false,
      };

      // Create a simple program to check for syntax errors
      const host = ts.createCompilerHost(compilerOptions);
      const originalGetSourceFile = host.getSourceFile;
      host.getSourceFile = (
        fileName: string,
        languageVersion: ts.ScriptTarget
      ) => {
        if (fileName === 'temp.ts') {
          return sourceFile;
        }
        return originalGetSourceFile(fileName, languageVersion);
      };

      const program = ts.createProgram(['temp.ts'], compilerOptions, host);
      const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile);

      if (syntacticDiagnostics.length > 0) {
        const firstError = syntacticDiagnostics[0];
        const message = ts.flattenDiagnosticMessageText(
          firstError.messageText,
          '\n'
        );
        const line = firstError.file
          ? ts.getLineAndCharacterOfPosition(
              firstError.file,
              firstError.start || 0
            ).line + 1
          : 0;
        return {
          isValid: false,
          error: `${message} (line ${line})`,
          details,
        };
      }

      // Extract imports for informational purposes
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier;
          if (ts.isStringLiteral(moduleSpecifier)) {
            details.imports.push(moduleSpecifier.text);
          }
        }
      });

      return {
        isValid: true,
        error: null,
        details,
      };
    } catch (e) {
      return {
        isValid: false,
        error: e instanceof Error ? e.message : String(e),
        details,
      };
    }
  }

  /**
   * Execute TypeScript code safely in a subprocess using ts-node.
   *
   * Security measures:
   * - Runs in separate process
   * - Timeout protection
   * - No direct system access from main process
   *
   * @returns Execution result with success, stdout, and stderr
   */
  executeCode(code: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      let tempFile: string | null = null;

      try {
        // Create temporary file
        const tempDir = os.tmpdir();
        tempFile = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.ts`);
        fs.writeFileSync(tempFile, code, 'utf-8');

        // Determine how to run ts-node with explicit compiler options to avoid tsconfig conflicts
        const command = this.tsNodePath || 'npx';
        const args = this.tsNodePath
          ? [tempFile]
          : [
              'ts-node',
              '--transpile-only',
              '--skip-project',
              '--compilerOptions',
              '{"module":"CommonJS","moduleResolution":"node","target":"ES2020","esModuleInterop":true}',
              tempFile,
            ];

        const child = spawn(command, args, {
          timeout: this.timeout * 1000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timeoutId = global.setTimeout(() => {
          child.kill('SIGTERM');
          resolve({
            success: false,
            output: null,
            error: `Timeout: execution exceeded ${this.timeout}s`,
          });
        }, this.timeout * 1000);

        child.on('close', (exitCode: number | null) => {
          global.clearTimeout(timeoutId);

          // Clean up temp file
          if (tempFile && fs.existsSync(tempFile)) {
            try {
              fs.unlinkSync(tempFile);
            } catch {
              // Ignore cleanup errors
            }
          }

          if (exitCode === 0) {
            resolve({
              success: true,
              output: stdout.trim(),
              error: null,
            });
          } else {
            resolve({
              success: false,
              output: stdout.trim() || null,
              error: stderr.trim() || `Process exited with code ${exitCode}`,
            });
          }
        });

        child.on('error', (err: Error) => {
          global.clearTimeout(timeoutId);

          // Clean up temp file
          if (tempFile && fs.existsSync(tempFile)) {
            try {
              fs.unlinkSync(tempFile);
            } catch {
              // Ignore cleanup errors
            }
          }

          resolve({
            success: false,
            output: null,
            error: `Execution error: ${err.message}`,
          });
        });
      } catch (e) {
        // Clean up temp file on error
        if (tempFile && fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch {
            // Ignore cleanup errors
          }
        }

        resolve({
          success: false,
          output: null,
          error: `Execution error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    });
  }

  /**
   * Compare actual output with expected output.
   *
   * Scoring (out of 30 points):
   * - Exact match: 30 points
   * - High similarity (>80%): 25-29 points
   * - Medium similarity (50-80%): 15-24 points
   * - Low similarity (<50%): 0-14 points
   *
   * @returns Tuple of [score, similarity_ratio]
   */
  compareOutput(actual: string, expected: string): [number, number] {
    const actualTrimmed = actual.trim();
    const expectedTrimmed = expected.trim();

    // Exact match
    if (actualTrimmed === expectedTrimmed) {
      return [30, 1.0];
    }

    // Normalise for comparison
    const actualNormalized = actualTrimmed.toLowerCase();
    const expectedNormalized = expectedTrimmed.toLowerCase();

    if (actualNormalized === expectedNormalized) {
      return [30, 1.0];
    }

    // Calculate similarity using Levenshtein-based ratio
    const similarity = this.calculateSimilarity(
      actualNormalized,
      expectedNormalized
    );

    // Also check if expected is contained in actual
    let adjustedSimilarity = similarity;
    if (actualNormalized.includes(expectedNormalized)) {
      adjustedSimilarity = Math.max(similarity, 0.85);
    }

    // Convert similarity to score (0-30 points)
    let score: number;
    if (adjustedSimilarity >= 0.8) {
      score = Math.floor(25 + (adjustedSimilarity - 0.8) * 25); // 25-30 points
    } else if (adjustedSimilarity >= 0.5) {
      score = Math.floor(15 + (adjustedSimilarity - 0.5) * 33.33); // 15-24 points
    } else {
      score = Math.floor(adjustedSimilarity * 30); // 0-14 points
    }

    return [Math.min(score, 30), adjustedSimilarity];
  }

  /**
   * Calculate similarity ratio between two strings using sequence matching.
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    // Simple longest common subsequence based similarity
    const lcs = this.longestCommonSubsequence(a, b);
    return (2.0 * lcs) / (a.length + b.length);
  }

  /**
   * Calculate longest common subsequence length.
   */
  private longestCommonSubsequence(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }
}

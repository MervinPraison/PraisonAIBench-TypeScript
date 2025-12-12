/**
 * Bench - Main benchmarking class for PraisonAI Bench TypeScript
 *
 * This module provides the core benchmarking functionality using agents
 * to evaluate LLM performance across different tasks and models.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BenchAgent, TestResult } from './agent';
import { CostTracker, CostSummary } from './cost-tracker';
import { PluginManager } from './plugin-manager';
import { ReportGenerator } from './report-generator';

export interface BenchConfig {
  default_model?: string;
  output_format?: 'json' | 'csv';
  save_results?: boolean;
  output_dir?: string;
  max_retries?: number;
  timeout?: number;
  apiKey?: string;
}

export interface TestConfig {
  name?: string;
  prompt: string;
  model?: string;
  language?: string;
  expected?: string;
}

export interface TestSuiteConfig {
  config?: Record<string, unknown>;
  tests: TestConfig[];
}

export interface BenchSummary {
  total_tests: number;
  successful_tests: number;
  failed_tests: number;
  success_rate: string;
  models_tested: string[];
  average_execution_time: string;
  timestamp: string;
  cost_summary?: CostSummary;
}

export interface BenchResult extends TestResult {
  evaluation?: Record<string, unknown>;
  language?: string;
}

/**
 * Main benchmarking class that orchestrates agents for comprehensive LLM testing.
 */
export class Bench {
  private results: BenchResult[] = [];
  private config: BenchConfig;
  private costTracker: CostTracker;
  private pluginManager: PluginManager | null = null;

  constructor(config: BenchConfig = {}, enableEvaluation = true) {
    this.config = {
      default_model: config.default_model || 'gpt-4o-mini',
      output_format: config.output_format || 'json',
      save_results: config.save_results ?? true,
      output_dir: config.output_dir || 'output',
      max_retries: config.max_retries || 3,
      timeout: config.timeout || 60,
      apiKey: config.apiKey,
    };

    this.costTracker = new CostTracker();

    if (enableEvaluation) {
      try {
        this.pluginManager = new PluginManager();
        const supportedLangs = this.pluginManager.listLanguages().join(', ');
        console.log(`✅ Loaded evaluators for: ${supportedLangs}`);
      } catch (error) {
        console.warn(
          `⚠️  Could not initialize plugin manager: ${error instanceof Error ? error.message : String(error)}`
        );
        this.pluginManager = null;
      }
    }
  }

  /**
   * Detect language from response or test configuration.
   */
  private detectLanguage(response: string, testConfig?: TestConfig): string {
    // Check explicit language in test config
    if (testConfig?.language) {
      return testConfig.language.toLowerCase();
    }

    // Check for code blocks with language tags
    const match = response.match(/```(\w+)/);
    if (match) {
      const lang = match[1].toLowerCase();
      if (lang !== 'code') {
        return lang;
      }
    }

    // Check for HTML indicators
    if (
      response.toLowerCase().includes('<!doctype') ||
      response.toLowerCase().includes('<html')
    ) {
      return 'html';
    }

    // Default to typescript
    return 'typescript';
  }

  /**
   * Run a single benchmark test.
   */
  async runSingleTest(
    prompt: string,
    model?: string,
    testName?: string,
    expected?: string,
    language?: string
  ): Promise<BenchResult> {
    if (!prompt || !prompt.trim()) {
      throw new Error('Prompt cannot be empty or None');
    }

    const finalModel = model || this.config.default_model || 'gpt-4o-mini';
    const finalTestName =
      testName ||
      `test_${new Date().toISOString().replace(/[:.]/g, '_').slice(0, -5)}`;

    console.log(`🧪 Starting test: ${finalTestName} with model: ${finalModel}`);

    // Create agent
    const agent = new BenchAgent({
      name: 'BenchAgent',
      model: finalModel,
      instructions: prompt,
      apiKey: this.config.apiKey,
      maxRetries: this.config.max_retries,
    });

    // Run test
    const result = await agent.runTest(prompt, finalTestName);
    const benchResult: BenchResult = { ...result };

    // Run evaluation if enabled
    if (
      this.pluginManager &&
      result.status === 'success' &&
      result.response
    ) {
      console.log('\n📊 Evaluating output...');

      const detectedLanguage = this.detectLanguage(result.response, {
        prompt,
        language,
      });
      const evaluator = this.pluginManager.getEvaluator(detectedLanguage);

      if (evaluator) {
        console.log(`  Using ${detectedLanguage} evaluator...`);
        try {
          const evaluation = await evaluator.evaluate(
            result.response,
            finalTestName,
            prompt,
            expected
          );

          benchResult.evaluation = evaluation as unknown as Record<string, unknown>;
          benchResult.language = detectedLanguage;

          const score = evaluation.overall_score || evaluation.score || 0;
          console.log(`  Overall Score: ${score}/100`);
          const statusEmoji = evaluation.passed ? '✅ PASSED' : '❌ FAILED';
          console.log(`  Status: ${statusEmoji}`);

          // Print feedback
          for (const item of evaluation.feedback || []) {
            console.log(`  ${item.message || ''}`);
          }
        } catch (error) {
          console.warn(
            `⚠️  Evaluation failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else {
        console.log(`  ⚠️  No evaluator found for language: ${detectedLanguage}`);
        console.log(
          `  Available: ${this.pluginManager.listLanguages().join(', ')}`
        );
      }
    }

    // Track costs
    if (result.status === 'success' && result.token_usage) {
      this.costTracker.addUsage(
        result.token_usage.input_tokens,
        result.token_usage.output_tokens,
        finalModel,
        result.cost?.total_usd
      );

      if (result.cost && result.cost.total_usd > 0) {
        console.log(
          `💰 Cost: $${result.cost.total_usd.toFixed(6)} (${result.token_usage.total_tokens} tokens)`
        );
      }
    }

    this.results.push(benchResult);
    return benchResult;
  }

  /**
   * Run a complete test suite from a YAML or JSON file.
   */
  async runTestSuite(
    testFile: string,
    testFilter?: string,
    defaultModel?: string,
    _concurrent = 1
  ): Promise<BenchResult[]> {
    if (!fs.existsSync(testFile)) {
      throw new Error(`Test file not found: ${testFile}`);
    }

    // Load test configuration
    const content = fs.readFileSync(testFile, 'utf-8');
    let tests: TestSuiteConfig;

    if (testFile.endsWith('.yaml') || testFile.endsWith('.yml')) {
      tests = yaml.load(content) as TestSuiteConfig;
    } else {
      tests = JSON.parse(content);
    }

    // Extract config and tests
    const testList = tests.tests || [];
    // Suite config available for future use
    void tests.config;

    // Filter tests if specified
    const filteredTests = testFilter
      ? testList.filter((t, i) => (t.name || `test_${i + 1}`) === testFilter)
      : testList;

    console.log(`\n📋 Running ${filteredTests.length} test(s)...`);

    // Run tests sequentially (concurrent execution can be added later)
    const suiteResults: BenchResult[] = [];

    for (let i = 0; i < filteredTests.length; i++) {
      const test = filteredTests[i];
      const testName = test.name || `test_${i + 1}`;
      const model = defaultModel || test.model;

      console.log(`\n[${i + 1}/${filteredTests.length}] ${testName}`);

      try {
        const result = await this.runSingleTest(
          test.prompt,
          model,
          testName,
          test.expected,
          test.language
        );
        suiteResults.push(result);

        if (result.status === 'success') {
          console.log(`  ✅ Completed: ${testName}`);
        } else {
          console.log(`  ❌ Failed: ${testName}`);
        }
      } catch (error) {
        console.log(
          `  ❌ Error: ${testName} - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return suiteResults;
  }

  /**
   * Run the same test across multiple models for comparison.
   */
  async runCrossModelTest(
    prompt: string,
    models?: string[]
  ): Promise<BenchResult[]> {
    const testModels = models || [this.config.default_model || 'gpt-4o-mini'];
    const crossModelResults: BenchResult[] = [];

    for (const model of testModels) {
      const result = await this.runSingleTest(
        prompt,
        model,
        `cross_model_${model.replace(/\//g, '_')}`
      );
      crossModelResults.push(result);
      console.log(`✓ Tested model: ${model}`);
    }

    return crossModelResults;
  }

  /**
   * Save benchmark results to file.
   */
  saveResults(filename?: string, format: 'json' | 'csv' = 'json'): string | null {
    if (!this.results.length) {
      console.log('No results to save');
      return null;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '')
      .slice(0, 15);
    const finalFilename =
      filename || `benchmark_results_${timestamp}.${format}`;

    const outputDir = path.join(this.config.output_dir || 'output', format);
    fs.mkdirSync(outputDir, { recursive: true });

    const filepath = path.join(outputDir, finalFilename);

    if (format === 'csv') {
      this.saveResultsCsv(filepath);
    } else {
      fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    }

    console.log(`Results saved to: ${filepath}`);
    return filepath;
  }

  private saveResultsCsv(filepath: string): void {
    const headers = [
      'test_name',
      'status',
      'model',
      'execution_time',
      'timestamp',
      'input_tokens',
      'output_tokens',
      'total_tokens',
      'cost_usd',
      'evaluation_score',
      'evaluation_passed',
      'prompt',
      'response_length',
      'error',
    ];

    const rows = this.results.map((r) => [
      r.test_name,
      r.status,
      r.model,
      r.execution_time.toFixed(2),
      r.timestamp,
      r.token_usage?.input_tokens || '',
      r.token_usage?.output_tokens || '',
      r.token_usage?.total_tokens || '',
      r.cost?.total_usd?.toFixed(6) || '',
      (r.evaluation as Record<string, number>)?.score || '',
      (r.evaluation as Record<string, boolean>)?.passed || '',
      `"${(r.prompt || '').replace(/"/g, '""')}"`,
      r.response?.length || 0,
      r.error || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    fs.writeFileSync(filepath, csv);
  }

  /**
   * Generate HTML report from results.
   */
  generateReport(outputPath?: string): string | null {
    if (!this.results.length) {
      console.log('No results to generate report from');
      return null;
    }

    const summary = this.getSummary();
    return ReportGenerator.generate(this.results, summary, outputPath);
  }

  /**
   * Get a summary of benchmark results including costs.
   */
  getSummary(): BenchSummary {
    if (!this.results.length) {
      return {
        total_tests: 0,
        successful_tests: 0,
        failed_tests: 0,
        success_rate: '0%',
        models_tested: [],
        average_execution_time: '0s',
        timestamp: new Date().toISOString(),
      };
    }

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(
      (r) => r.status === 'success'
    ).length;
    const failedTests = totalTests - successfulTests;

    const modelNames = [
      ...new Set(this.results.map((r) => r.model)),
    ];

    const avgExecutionTime =
      this.results.reduce((sum, r) => sum + r.execution_time, 0) / totalTests;

    const costSummary = this.costTracker.getSummary();

    return {
      total_tests: totalTests,
      successful_tests: successfulTests,
      failed_tests: failedTests,
      success_rate: `${((successfulTests / totalTests) * 100).toFixed(1)}%`,
      models_tested: modelNames,
      average_execution_time: `${avgExecutionTime.toFixed(2)}s`,
      timestamp: new Date().toISOString(),
      cost_summary: costSummary,
    };
  }

  /**
   * Get all results.
   */
  getResults(): BenchResult[] {
    return this.results;
  }

  /**
   * Clear all results.
   */
  clearResults(): void {
    this.results = [];
    this.costTracker.reset();
  }
}

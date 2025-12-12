#!/usr/bin/env node
/**
 * CLI - Command Line Interface for PraisonAI Bench TypeScript
 *
 * Simple command-line interface for running benchmarks.
 */

import { Command } from 'commander';
import { Bench } from './bench';
import { VERSION } from './version';
import * as fs from 'fs';

const program = new Command();

program
  .name('praisonaibench')
  .description('PraisonAI Bench TypeScript - LLM Benchmarking Tool')
  .version(VERSION);

// Single test
program
  .option('--test <prompt>', 'Run a single test with the given prompt')
  .option('--model <model>', 'Model to use (default: gpt-4o-mini)')
  .option('--expected <expected>', 'Expected output for comparison');

// Test suite
program
  .option('--suite <file>', 'Run test suite from YAML/JSON file')
  .option('--test-name <name>', 'Run only the specified test from the suite')
  .option(
    '--concurrent <n>',
    'Number of concurrent workers (default: 1)',
    '1'
  );

// Cross-model testing
program
  .option('--cross-model <prompt>', 'Run same test across multiple models')
  .option('--models <models>', 'Comma-separated list of models to test');

// Configuration
program
  .option('--config <file>', 'Configuration file path')
  .option('--no-eval', 'Disable evaluation system');

// Output options
program
  .option('--output <file>', 'Output file for results')
  .option('--format <format>', 'Output format: json or csv', 'json')
  .option('--report', 'Generate HTML report');

async function main() {
  program.parse();
  const opts = program.opts();

  console.log(`🚀 PraisonAI Bench TypeScript v${VERSION} initialized`);
  console.log('Using OpenAI API - supports gpt-4o, gpt-4o-mini, gpt-3.5-turbo, etc.');

  // Initialize bench
  const bench = new Bench(
    {
      default_model: opts.model || 'gpt-4o-mini',
      output_format: opts.format as 'json' | 'csv',
    },
    opts.eval !== false
  );

  try {
    // Run single test
    if (opts.test) {
      const modelName = opts.model || 'gpt-4o-mini';
      console.log(`\n🧪 Running single test with ${modelName} model...`);

      const result = await bench.runSingleTest(
        opts.test,
        opts.model,
        undefined,
        opts.expected
      );

      console.log(`✅ Test completed in ${result.execution_time.toFixed(2)}s`);
      if (result.response) {
        console.log(`Response length: ${result.response.length} characters`);
      }
    }
    // Run test suite
    else if (opts.suite) {
      if (!fs.existsSync(opts.suite)) {
        console.error(`❌ Test suite file not found: ${opts.suite}`);
        process.exit(1);
      }

      const concurrent = parseInt(opts.concurrent, 10) || 1;
      const concurrentMsg = concurrent > 1 ? ` (concurrent: ${concurrent})` : '';

      if (opts.testName) {
        console.log(`\n📋 Running test '${opts.testName}' from ${opts.suite}...`);
      } else {
        console.log(`\n📋 Running test suite from ${opts.suite}${concurrentMsg}...`);
      }

      const results = await bench.runTestSuite(
        opts.suite,
        opts.testName,
        opts.model,
        concurrent
      );

      if (opts.testName) {
        console.log(`✅ Test '${opts.testName}' completed`);
      } else {
        console.log(`✅ Test suite completed: ${results.length} tests`);
      }
    }
    // Run cross-model test
    else if (opts.crossModel) {
      const models = opts.models ? opts.models.split(',') : undefined;
      console.log('\n🔄 Running cross-model test...');

      const results = await bench.runCrossModelTest(opts.crossModel, models);
      console.log(`✅ Cross-model test completed: ${results.length} models tested`);
    }
    // Default: look for tests.yaml
    else {
      const defaultSuite = 'tests.yaml';
      if (fs.existsSync(defaultSuite)) {
        console.log(`\n📋 No command specified, running default test suite: ${defaultSuite}...`);
        const results = await bench.runTestSuite(defaultSuite, opts.testName, opts.model);
        console.log(`✅ Test suite completed: ${results.length} tests`);
      } else {
        console.log('\n❌ No command specified and default test suite not found.');
        console.log('\nUsage:');
        console.log('  praisonaibench --test "Your prompt here"');
        console.log('  praisonaibench --suite your_suite.yaml');
        console.log('  praisonaibench --cross-model "Your prompt" --models gpt-4o,gpt-4o-mini');
        program.help();
        process.exit(1);
      }
    }

    // Show summary
    const summary = bench.getSummary();
    console.log('\n📊 Summary:');
    console.log(`   Total tests: ${summary.total_tests}`);
    console.log(`   Success rate: ${summary.success_rate}`);
    console.log(`   Average time: ${summary.average_execution_time}`);

    // Show cost summary
    if (summary.cost_summary) {
      const costInfo = summary.cost_summary;
      console.log('\n💰 Cost Summary:');
      console.log(`   Total tokens: ${costInfo.total_tokens.toLocaleString()}`);
      console.log(`   Total cost: $${costInfo.total_cost_usd.toFixed(4)}`);

      if (Object.keys(costInfo.by_model).length > 1) {
        console.log('\n   By model:');
        for (const [model, data] of Object.entries(costInfo.by_model)) {
          console.log(
            `     ${model}: $${data.cost.toFixed(4)} (${data.input_tokens + data.output_tokens} tokens)`
          );
        }
      }
    }

    // Save results
    if (opts.output) {
      bench.saveResults(opts.output, opts.format as 'json' | 'csv');
    } else {
      bench.saveResults(undefined, opts.format as 'json' | 'csv');
    }

    // Generate report
    if (opts.report) {
      bench.generateReport();
    }
  } catch (error) {
    console.error(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

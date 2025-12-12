/**
 * PraisonAI Bench TypeScript - LLM Benchmarking Framework
 *
 * A comprehensive TypeScript framework for benchmarking LLM code generation.
 */

// Core exports
export { Bench } from './bench';
export { BenchAgent } from './agent';
export { TypeScriptEvaluator } from './evaluator';
export { BaseEvaluator } from './base-evaluator';
export { PluginManager } from './plugin-manager';
export { CostTracker } from './cost-tracker';
export { ReportGenerator } from './report-generator';
export { VERSION as __version__ } from './version';

// Provider exports
export {
  getModel,
  getModelFromString,
  parseModelString,
  getConfiguredProviders,
  getAllProviders,
  getProviderConfig,
  isProviderConfigured,
  PROVIDERS,
} from './providers';

export type { ProviderName, ProviderConfig } from './providers';

// Re-export types
export type {
  BenchConfig,
  TestConfig,
  TestSuiteConfig,
  BenchSummary,
  BenchResult,
} from './bench';

export type {
  AgentConfig,
  TestResult,
} from './agent';

export type {
  EvaluationResult,
  FeedbackItem,
  EvaluationDetails,
  ScoreBreakdown,
} from './evaluator';

export type {
  EvaluationResult as BaseEvaluationResult,
  FeedbackItem as BaseFeedbackItem,
} from './base-evaluator';

export type {
  CostSummary,
  TokenUsage,
  CostInfo,
  ModelPricing,
} from './cost-tracker';

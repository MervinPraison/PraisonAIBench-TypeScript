# PraisonAI Bench TypeScript

🚀 **A powerful LLM benchmarking framework for TypeScript code generation**

Benchmark any OpenAI-compatible model with automatic code evaluation, TypeScript execution, and comprehensive HTML reports.

[![Node.js 16+](https://img.shields.io/badge/node-16+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![npm version](https://img.shields.io/npm/v/praisonaibench-typescript.svg)](https://www.npmjs.com/package/praisonaibench-typescript)

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **🤖 Any OpenAI Model** | GPT-4o, GPT-4o-mini, GPT-3.5-turbo, etc. |
| **📊 Multi-Stage Evaluation** | Syntax validation, code execution, output comparison |
| **💰 Cost & Token Tracking** | Automatic token usage and cost calculation |
| **📈 HTML Reports** | Beautiful dashboard reports with charts |
| **⚡ Parallel Execution** | Run tests concurrently |
| **🔌 Plugin System** | Extensible evaluators for any language |
| **🎯 Test Suites** | YAML/JSON test suite support |
| **🔄 Retry Logic** | Automatic retries with exponential backoff |

## 📊 Evaluation System

| Stage | Points | Description |
|-------|--------|-------------|
| **Syntax Validation** | 30 | TypeScript compiler API parsing |
| **Code Execution** | 40 | Safe ts-node subprocess execution |
| **Output Comparison** | 30 | Fuzzy matching with expected output |
| **Total** | **100** | Pass threshold: ≥70 |

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g praisonaibench-typescript

# Or install locally
npm install praisonaibench-typescript
```

### Set API Key

```bash
export OPENAI_API_KEY=your_api_key_here
```

### Run Your First Test

```bash
# Single test
praisonaibench --test "Write TypeScript code that prints Hello World"

# With specific model
praisonaibench --test "Calculate factorial of 5" --model gpt-4o-mini

# Run test suite
praisonaibench --suite tests.yaml --report
```

### Verify Installation

```bash
# Check version
node -e "const { TypeScriptEvaluator } = require('./dist'); console.log('Plugin loaded successfully!');"
```

### Configuration

Create a `.env` file (or copy from `.env.example`):

```bash
# OpenAI API Key for LLM-based benchmarking
OPENAI_API_KEY=your_api_key_here

# Default model
DEFAULT_MODEL=gpt-4o-mini

# Execution timeout (seconds)
TYPESCRIPT_EXECUTION_TIMEOUT=5
```

### Basic Usage

Create a test suite file `tests.yaml`:

```yaml
tests:
  - name: "hello_world"
    language: "typescript"
    prompt: "Write TypeScript code that prints 'Hello World'"
    expected: "Hello World"
  
  - name: "calculate_factorial"
    language: "typescript"
    prompt: "Write a TypeScript function that calculates factorial of 5"
    expected: "120"
```

Run the benchmarks:

```bash
praisonaibench --suite tests.yaml --model gpt-4o-mini
```

## 📊 Evaluation System

### Scoring Breakdown

The evaluator uses a three-stage assessment system:

| Stage | Points | Description |
|-------|--------|-------------|
| **Syntax Validation** | 30 | TypeScript compiler API parsing, import detection |
| **Code Execution** | 40 | Safe ts-node subprocess execution, error capture |
| **Output Comparison** | 30 | Fuzzy matching with expected output |
| **Total** | **100** | Combined score |

**Pass Threshold**: 70/100 points

### Scoring Examples

#### Example 1: Perfect Score (100/100)

```typescript
// Code: console.log("Hello World")
// Expected: "Hello World"

✅ Syntax: 30 points (valid TypeScript)
✅ Execution: 40 points (runs successfully)
✅ Output: 30 points (exact match)
─────────────────────────
Total: 100/100 ✅ PASSED
```

#### Example 2: Partial Score (70/100)

```typescript
// Code: console.log("Hello")
// Expected: "Hello World"

✅ Syntax: 30 points (valid TypeScript)
✅ Execution: 40 points (runs successfully)
⚠️  Output: 0 points (different output)
─────────────────────────
Total: 70/100 ✅ PASSED
```

#### Example 3: Failure (30/100)

```typescript
// Code: console.log(undefinedVar)
// Expected: "Hello World"

✅ Syntax: 30 points (valid syntax)
❌ Execution: 0 points (ReferenceError)
❌ Output: 0 points (didn't execute)
─────────────────────────
Total: 30/100 ❌ FAILED
```

## 📖 Usage Guide

### TypeScript API

```typescript
import { TypeScriptEvaluator } from 'praisonaibench-typescript';

// Create evaluator
const evaluator = new TypeScriptEvaluator(5); // 5 second timeout

// Evaluate code
const result = await evaluator.evaluate(
  'console.log("Hello World")',
  "hello_test",
  "Write TypeScript code that prints Hello World",
  "Hello World"
);

// Check results
console.log(`Score: ${result.score}/100`);
console.log(`Passed: ${result.passed}`);

// View feedback
for (const item of result.feedback) {
  console.log(`${item.level}: ${item.message}`);
}

// Access details
console.log(`Output: ${result.details.output}`);
console.log(`Score breakdown:`, result.details.score_breakdown);
```

### Test Suite Format

#### Simple Test

```yaml
tests:
  - name: "basic_math"
    language: "typescript"
    prompt: "Calculate 15 * 23 and print the result"
    expected: "345"
```

#### Advanced Test

```yaml
tests:
  - name: "fibonacci"
    language: "typescript"
    prompt: |
      Write a TypeScript function that calculates the nth Fibonacci number.
      Calculate and print the 10th Fibonacci number.
    expected: "55"
```

#### Test Without Expected Output

```yaml
tests:
  - name: "creative_code"
    language: "typescript"
    prompt: "Write a TypeScript class for a simple calculator"
    # No expected field - evaluation based on syntax and execution only
```

## 🎨 Features

### Security Features

- ✅ **Subprocess Isolation** - Code runs in separate process via ts-node
- ✅ **Timeout Protection** - Configurable execution timeout (default: 5s)
- ✅ **Resource Limits** - Prevents infinite loops and resource exhaustion
- ✅ **Error Handling** - Graceful handling of all error types

### Code Extraction

Automatically extracts code from various formats:

```typescript
// Supports typescript code blocks
`​`​`typescript
console.log("Hello")
`​`​`

// Supports ts code blocks
`​`​`ts
console.log("Hello")
`​`​`

// Supports generic code blocks
`​`​`
console.log("Hello")
`​`​`

// Supports raw code
console.log('Hello')
```

### Output Comparison

Smart fuzzy matching algorithm:

- **Exact match**: 30/30 points
- **High similarity** (>80%): 25-29 points
- **Medium similarity** (50-80%): 15-24 points
- **Low similarity** (<50%): 0-14 points

Features:
- Case-insensitive comparison
- Whitespace normalisation
- Substring matching (e.g., "345" in "The answer is 345")

### Detailed Feedback

```typescript
{
  score: 85,
  passed: true,
  feedback: [
    { level: "success", message: "✅ Valid TypeScript syntax" },
    { level: "info", message: "📦 Imports: fs, path" },
    { level: "success", message: "✅ Code executed successfully" },
    { level: "info", message: "📤 Output: Hello World" },
    { level: "warning", message: "⚠️  Output partially matches expected" }
  ],
  details: {
    extracted_code: "console.log('Hello World')",
    executed: true,
    output: "Hello World",
    similarity: 0.95,
    score_breakdown: {
      syntax: 30,
      execution: 40,
      output_match: 28
    }
  }
}
```

## 📚 Examples

### Example 1: Hello World

```yaml
tests:
  - name: "hello_world"
    language: "typescript"
    prompt: "Write TypeScript code that prints 'Hello World'"
    expected: "Hello World"
```

### Example 2: Factorial Function

```yaml
tests:
  - name: "factorial"
    language: "typescript"
    prompt: |
      Write a TypeScript function that calculates the factorial of a number.
      Calculate factorial(5) and print the result.
    expected: "120"
```

### Example 3: Interface Usage

```yaml
tests:
  - name: "interface_test"
    language: "typescript"
    prompt: |
      Define a Person interface with name and age properties.
      Create a person and print their name.
    expected: "Alice"
```

More examples available in:
- `examples/simple_tests.yaml` - Basic TypeScript tests
- `examples/advanced_tests.yaml` - Complex TypeScript challenges
- `examples/algorithm_tests.yaml` - Algorithm implementations

## 🧪 Testing

### Run Unit Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Coverage

The plugin includes comprehensive tests:

- ✅ **Unit Tests** (`tests/evaluator.test.ts`)
  - Code extraction
  - Syntax validation
  - Code execution
  - Output comparison
  - Error handling
  - Timeout protection

- ✅ **Integration Tests** (`tests/integration.test.ts`)
  - Plugin interface compatibility
  - Multiple test scenarios
  - Concurrent evaluations
  - Large output handling
  - Import support

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_api_key_here

# Optional
DEFAULT_MODEL=gpt-4o-mini
TYPESCRIPT_EXECUTION_TIMEOUT=5
TS_NODE_EXECUTABLE=/path/to/ts-node  # Leave empty for npx
```

### Programmatic Configuration

```typescript
import { TypeScriptEvaluator } from 'praisonaibench-typescript';

// Custom timeout
const evaluator = new TypeScriptEvaluator(10);

// Custom ts-node path
const evaluator = new TypeScriptEvaluator(
  5,
  "/usr/local/bin/ts-node"
);
```

## 🏗️ Architecture

### Plugin Structure

```
praisonaibench-typescript/
├── src/
│   ├── index.ts              # Plugin exports
│   ├── evaluator.ts          # Main evaluator class
│   └── version.ts            # Version info
├── tests/
│   ├── evaluator.test.ts     # Unit tests
│   └── integration.test.ts   # Integration tests
├── examples/
│   ├── simple_tests.yaml
│   ├── advanced_tests.yaml
│   └── algorithm_tests.yaml
├── package.json              # Project configuration
├── tsconfig.json             # TypeScript config
├── .env                      # Configuration
└── README.md                 # This file
```

### Class Hierarchy

```
BaseEvaluator (interface)
    └── TypeScriptEvaluator
        ├── getLanguage() → 'typescript'
        ├── getFileExtension() → 'ts'
        └── evaluate(code, testName, prompt, expected) → Promise<EvaluationResult>
```

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

### Development Setup

```bash
# Clone repository
git clone https://github.com/MervinPraison/PraisonAIBench-TypeScript
cd praisonaibench-typescript

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/praisonaibench-typescript) - Install from npm
- [PraisonAI Bench](https://github.com/MervinPraison/praisonaibench) - Main project
- [Plugin System Documentation](https://github.com/MervinPraison/praisonaibench/blob/main/PLUGIN_SYSTEM.md)
- [Issue Tracker](https://github.com/MervinPraison/PraisonAIBench-TypeScript/issues)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/MervinPraison/PraisonAIBench-TypeScript/issues)
- **Documentation**: [PraisonAI Bench Docs](https://github.com/MervinPraison/praisonaibench#readme)
- **Community**: Join the discussion on GitHub

## 🎉 Acknowledgements

Built with ❤️ for the PraisonAI Bench community.

Special thanks to:
- [PraisonAI](https://github.com/MervinPraison) - For the amazing benchmarking framework
- Contributors and testers
- The TypeScript community

---

**Ready to benchmark TypeScript code generation? Install the plugin and start testing!** 🚀

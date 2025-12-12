# PraisonAI Bench Plugin System

Create evaluators for **any programming language** in a single file!

## Quick Start (Plugin Creator)

### 1. Create Your Evaluator

```typescript
// my-evaluator.ts
import { BaseEvaluator, EvaluationResult } from 'praisonaibench';

export class PythonEvaluator extends BaseEvaluator {
  getLanguage(): string {
    return 'python';
  }

  getFileExtension(): string {
    return 'py';
  }

  async evaluate(
    code: string,
    testName: string,
    prompt: string,
    expected?: string
  ): Promise<EvaluationResult> {
    // Your evaluation logic here
    return {
      score: 85,
      passed: true,
      feedback: [
        { level: 'success', message: '✅ Code executed successfully' }
      ],
      details: {
        // Additional details
      }
    };
  }
}
```

### 2. Configure package.json

```json
{
  "name": "praisonaibench-python",
  "version": "1.0.0",
  "main": "dist/index.js",
  "praisonaibench": {
    "evaluators": {
      "python": "./dist/evaluator.js"
    }
  },
  "peerDependencies": {
    "praisonaibench": ">=0.1.0"
  }
}
```

### 3. Export Your Evaluator

```typescript
// index.ts
export { PythonEvaluator } from './evaluator';
```

### 4. Install & Use

```bash
# Install your plugin
npm install praisonaibench-python

# It's automatically discovered!
praisonaibench --test "Write Python code" --model gpt-4o-mini
```

## Plugin Discovery

PraisonAI Bench automatically discovers plugins by scanning `node_modules` for packages with a `praisonaibench.evaluators` field in their `package.json`.

### How It Works

1. **Scan** - PluginManager scans `node_modules` directories
2. **Detect** - Finds packages with `praisonaibench.evaluators` field
3. **Load** - Dynamically loads the evaluator class
4. **Validate** - Ensures it extends `BaseEvaluator`
5. **Register** - Registers with the language name

## BaseEvaluator Interface

All evaluators must extend `BaseEvaluator` and implement these methods:

```typescript
abstract class BaseEvaluator {
  // Required: Return language identifier (lowercase)
  abstract getLanguage(): string;

  // Required: Evaluate code and return result
  abstract evaluate(
    code: string,
    testName: string,
    prompt: string,
    expected?: string
  ): Promise<EvaluationResult>;

  // Optional: Return file extension (default: language name)
  getFileExtension(): string;
}
```

## EvaluationResult Format

```typescript
interface EvaluationResult {
  score: number;        // 0-100
  passed: boolean;      // typically score >= 70
  feedback: FeedbackItem[];
  details?: Record<string, unknown>;
  overall_score?: number;
}

interface FeedbackItem {
  level: 'success' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}
```

## Scoring Guidelines

| Component | Points | Description |
|-----------|--------|-------------|
| Syntax Valid | 30 | Code parses without errors |
| Execution | 40 | Code runs successfully |
| Output Match | 30 | Output matches expected |
| **Total** | **100** | Pass threshold: ≥70 |

## Example: Python Evaluator

```typescript
import { BaseEvaluator, EvaluationResult } from 'praisonaibench';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class PythonEvaluator extends BaseEvaluator {
  private timeout: number;
  private pythonPath: string;

  constructor(timeout = 5000, pythonPath = 'python3') {
    super();
    this.timeout = timeout;
    this.pythonPath = pythonPath;
  }

  getLanguage(): string {
    return 'python';
  }

  getFileExtension(): string {
    return 'py';
  }

  async evaluate(
    code: string,
    testName: string,
    prompt: string,
    expected?: string
  ): Promise<EvaluationResult> {
    const feedback: FeedbackItem[] = [];
    let score = 0;

    // Extract code from markdown
    const extractedCode = this.extractCode(code);

    // 1. Syntax validation (30 points)
    const syntaxResult = await this.validateSyntax(extractedCode);
    if (syntaxResult.valid) {
      score += 30;
      feedback.push({ level: 'success', message: '✅ Valid Python syntax' });
    } else {
      feedback.push({ 
        level: 'error', 
        message: '❌ Syntax error',
        details: syntaxResult.error 
      });
      return { score, passed: false, feedback };
    }

    // 2. Execution (40 points)
    const execResult = await this.executeCode(extractedCode);
    if (execResult.success) {
      score += 40;
      feedback.push({ 
        level: 'success', 
        message: '✅ Code executed successfully',
        details: `Output: ${execResult.output}`
      });
    } else {
      feedback.push({ 
        level: 'error', 
        message: '❌ Execution failed',
        details: execResult.error 
      });
    }

    // 3. Output comparison (30 points)
    if (expected && execResult.output) {
      const similarity = this.compareOutput(execResult.output, expected);
      const outputScore = Math.round(similarity * 30);
      score += outputScore;
      
      if (similarity >= 0.9) {
        feedback.push({ level: 'success', message: '✅ Output matches expected' });
      } else if (similarity >= 0.5) {
        feedback.push({ level: 'warning', message: '⚠️ Partial output match' });
      }
    } else if (!expected) {
      score += 30; // No expected output, give full points
    }

    return {
      score,
      passed: score >= 70,
      feedback,
      details: {
        execution_output: execResult.output,
        execution_error: execResult.error,
      }
    };
  }

  private extractCode(response: string): string {
    const match = response.match(/```python\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : response.trim();
  }

  private async validateSyntax(code: string): Promise<{ valid: boolean; error?: string }> {
    // Use python -m py_compile to check syntax
    return new Promise((resolve) => {
      const tempFile = path.join(os.tmpdir(), `syntax_check_${Date.now()}.py`);
      fs.writeFileSync(tempFile, code);

      const proc = spawn(this.pythonPath, ['-m', 'py_compile', tempFile]);
      let stderr = '';

      proc.stderr.on('data', (data) => { stderr += data; });
      proc.on('close', (exitCode) => {
        fs.unlinkSync(tempFile);
        resolve(exitCode === 0 ? { valid: true } : { valid: false, error: stderr });
      });
    });
  }

  private async executeCode(code: string): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.pythonPath, ['-c', code]);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, error: 'Timeout' });
      }, this.timeout);

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode === 0 
          ? { success: true, output: stdout.trim() }
          : { success: false, error: stderr || 'Execution failed' }
        );
      });
    });
  }

  private compareOutput(actual: string, expected: string): number {
    const a = actual.toLowerCase().trim();
    const e = expected.toLowerCase().trim();
    if (a === e) return 1.0;
    if (a.includes(e) || e.includes(a)) return 0.85;
    return 0;
  }
}
```

## Programmatic Registration

You can also register evaluators programmatically:

```typescript
import { PluginManager, BaseEvaluator } from 'praisonaibench';

const manager = new PluginManager();

// Register a custom evaluator
manager.register('mylang', new MyLangEvaluator());

// Load from a specific package
manager.loadPluginFromPackage('praisonaibench-python');

// List all languages
console.log(manager.listLanguages());
// ['html', 'mylang', 'python', 'ts', 'typescript']
```

## CLI Commands

```bash
# List available evaluators
praisonaibench --list-providers

# Run test with specific language
praisonaibench --test "Write Python code" --model gpt-4o-mini

# The language is auto-detected from the response
```

## Best Practices

1. **Timeout Protection** - Always implement timeouts for code execution
2. **Sandbox Execution** - Run code in isolated environments when possible
3. **Clear Feedback** - Provide actionable feedback messages
4. **Consistent Scoring** - Follow the 30/40/30 scoring pattern
5. **Error Handling** - Gracefully handle all error cases

## Publishing Your Plugin

1. Build your TypeScript: `npm run build`
2. Test locally: `npm link && npm link praisonaibench-yourplugin`
3. Publish to npm: `npm publish`

Users can then install with:
```bash
npm install praisonaibench-yourplugin
```

The plugin is automatically discovered and loaded!

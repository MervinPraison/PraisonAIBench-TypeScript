/**
 * Unit tests for TypeScriptEvaluator
 *
 * Tests cover:
 * - Code extraction from markdown
 * - Syntax validation
 * - Code execution
 * - Output comparison
 * - Error handling
 * - Timeout protection
 */

import { TypeScriptEvaluator } from '../src/evaluator';

describe('TypeScriptEvaluator', () => {
  let evaluator: TypeScriptEvaluator;

  beforeEach(() => {
    evaluator = new TypeScriptEvaluator(3);
  });

  describe('getLanguage', () => {
    it('should return "typescript"', () => {
      expect(evaluator.getLanguage()).toBe('typescript');
    });
  });

  describe('getFileExtension', () => {
    it('should return "ts"', () => {
      expect(evaluator.getFileExtension()).toBe('ts');
    });
  });

  describe('extractCode', () => {
    it('should extract code from typescript markdown block', () => {
      const codeWithMarkdown = '```typescript\nconsole.log("Hello")\n```';
      const extracted = evaluator.extractCode(codeWithMarkdown);
      expect(extracted).toBe('console.log("Hello")');
    });

    it('should extract code from ts markdown block', () => {
      const codeWithTs = '```ts\nconsole.log("World")\n```';
      const extracted = evaluator.extractCode(codeWithTs);
      expect(extracted).toBe('console.log("World")');
    });

    it('should extract code from generic markdown block', () => {
      const codeGeneric = '```\nconsole.log("Test")\n```';
      const extracted = evaluator.extractCode(codeGeneric);
      expect(extracted).toBe('console.log("Test")');
    });

    it('should return raw code without markdown', () => {
      const rawCode = 'console.log("Hello World")';
      const extracted = evaluator.extractCode(rawCode);
      expect(extracted).toBe(rawCode);
    });
  });

  describe('validateSyntax', () => {
    it('should validate correct TypeScript syntax', () => {
      const validCode = 'console.log("Hello World")';
      const result = evaluator.validateSyntax(validCode);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should detect invalid syntax', () => {
      const invalidCode = 'console.log("Hello World"';
      const result = evaluator.validateSyntax(invalidCode);
      expect(result.isValid).toBe(false);
      expect(result.error).not.toBeNull();
    });

    it('should detect imports', () => {
      const codeWithImports = `
import * as fs from 'fs';
import { join } from 'path';

console.log("Hello");
`;
      const result = evaluator.validateSyntax(codeWithImports);
      expect(result.isValid).toBe(true);
      expect(result.details.imports).toContain('fs');
      expect(result.details.imports).toContain('path');
    });

    it('should validate TypeScript-specific syntax', () => {
      const tsCode = `
interface Person {
  name: string;
  age: number;
}

const person: Person = { name: "John", age: 30 };
console.log(person.name);
`;
      const result = evaluator.validateSyntax(tsCode);
      expect(result.isValid).toBe(true);
    });

    it('should validate generic types', () => {
      const genericCode = `
function identity<T>(arg: T): T {
  return arg;
}
console.log(identity<string>("hello"));
`;
      const result = evaluator.validateSyntax(genericCode);
      expect(result.isValid).toBe(true);
    });
  });

  describe('executeCode', () => {
    it('should execute simple code', async () => {
      const code = 'console.log("Hello World")';
      const result = await evaluator.executeCode(code);
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello World');
      expect(result.error).toBeNull();
    });

    it('should execute code with calculations', async () => {
      const code = 'const result = 15 * 23;\nconsole.log(result);';
      const result = await evaluator.executeCode(code);
      expect(result.success).toBe(true);
      expect(result.output).toBe('345');
    });

    it('should handle runtime errors', async () => {
      const code = 'const x: any = undefined;\nconsole.log(x.property);';
      const result = await evaluator.executeCode(code);
      expect(result.success).toBe(false);
      expect(result.error).not.toBeNull();
    });

    it('should handle timeout', async () => {
      const shortTimeoutEvaluator = new TypeScriptEvaluator(1);
      const code = `
const start = Date.now();
while (Date.now() - start < 5000) {}
console.log("done");
`;
      const result = await shortTimeoutEvaluator.executeCode(code);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    }, 10000);
  });

  describe('compareOutput', () => {
    it('should return perfect score for exact match', () => {
      const [score, similarity] = evaluator.compareOutput(
        'Hello World',
        'Hello World'
      );
      expect(score).toBe(30);
      expect(similarity).toBe(1.0);
    });

    it('should be case insensitive', () => {
      const [score, similarity] = evaluator.compareOutput(
        'HELLO WORLD',
        'hello world'
      );
      expect(score).toBe(30);
      expect(similarity).toBe(1.0);
    });

    it('should handle partial match when expected is contained', () => {
      const [score, similarity] = evaluator.compareOutput(
        'The answer is 345',
        '345'
      );
      expect(score).toBeGreaterThanOrEqual(20);
      expect(similarity).toBeGreaterThanOrEqual(0.5);
    });

    it('should return low score for no match', () => {
      const [score, similarity] = evaluator.compareOutput('Hello', 'Goodbye');
      expect(score).toBeLessThan(15);
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('evaluate', () => {
    it('should return perfect score for valid code with matching output', async () => {
      const code = 'console.log("Hello World")';
      const result = await evaluator.evaluate(
        code,
        'test_hello',
        'Write TypeScript code that prints Hello World',
        'Hello World'
      );

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
    });

    it('should pass without expected output', async () => {
      const code = 'console.log("Test")';
      const result = await evaluator.evaluate(
        code,
        'test_no_expected',
        'Write TypeScript code'
      );

      expect(result.score).toBe(70);
      expect(result.passed).toBe(true);
    });

    it('should fail for syntax errors', async () => {
      const code = 'console.log("Hello"';
      const result = await evaluator.evaluate(
        code,
        'test_syntax_error',
        'Write TypeScript code'
      );

      expect(result.score).toBeLessThan(70);
      expect(result.passed).toBe(false);
      const errorFeedback = result.feedback.filter((f) => f.level === 'error');
      expect(errorFeedback.length).toBeGreaterThan(0);
    });

    it('should handle runtime errors', async () => {
      const code = 'throw new Error("Test error")';
      const result = await evaluator.evaluate(
        code,
        'test_runtime_error',
        'Write TypeScript code'
      );

      expect(result.score).toBe(30);
      expect(result.passed).toBe(false);
    });

    it('should extract code from markdown', async () => {
      const code = '```typescript\nconsole.log("Hello World")\n```';
      const result = await evaluator.evaluate(
        code,
        'test_markdown',
        'Write TypeScript code that prints Hello World',
        'Hello World'
      );

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
    });

    it('should evaluate factorial function', async () => {
      const code = `
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log(factorial(5));
`;
      const result = await evaluator.evaluate(
        code,
        'test_factorial',
        'Write a TypeScript function that calculates factorial',
        '120'
      );

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('should include score breakdown in details', async () => {
      const code = 'console.log("Test")';
      const result = await evaluator.evaluate(
        code,
        'test_breakdown',
        'Write TypeScript code'
      );

      expect(result.details).toBeDefined();
      expect(result.details.score_breakdown).toBeDefined();
      expect(result.details.score_breakdown?.syntax).toBeDefined();
      expect(result.details.score_breakdown?.execution).toBeDefined();
      expect(result.details.score_breakdown?.output_match).toBeDefined();
    });
  });
});

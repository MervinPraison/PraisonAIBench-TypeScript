/**
 * Integration tests for TypeScriptEvaluator with PraisonAI Bench
 *
 * Tests the plugin working with the actual PraisonAI Bench system.
 */

import { TypeScriptEvaluator } from '../src/evaluator';

describe('Integration Tests', () => {
  let evaluator: TypeScriptEvaluator;

  beforeEach(() => {
    evaluator = new TypeScriptEvaluator();
  });

  describe('Plugin Interface Compatibility', () => {
    it('should implement required BaseEvaluator interface', () => {
      expect(evaluator.getLanguage).toBeDefined();
      expect(evaluator.getFileExtension).toBeDefined();
      expect(evaluator.evaluate).toBeDefined();

      expect(typeof evaluator.getLanguage).toBe('function');
      expect(typeof evaluator.getFileExtension).toBe('function');
      expect(typeof evaluator.evaluate).toBe('function');
    });
  });

  describe('Evaluate Return Format', () => {
    it('should return correct format', async () => {
      const result = await evaluator.evaluate(
        'console.log("test")',
        'format_test',
        'Test prompt'
      );

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('feedback');
      expect(result).toHaveProperty('details');

      expect(typeof result.score).toBe('number');
      expect(typeof result.passed).toBe('boolean');
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(typeof result.details).toBe('object');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Feedback Format', () => {
    it('should have correct feedback item format', async () => {
      const result = await evaluator.evaluate(
        'console.log("test")',
        'feedback_test',
        'Test prompt'
      );

      for (const feedbackItem of result.feedback) {
        expect(feedbackItem).toHaveProperty('level');
        expect(feedbackItem).toHaveProperty('message');
        expect(['success', 'warning', 'error', 'info']).toContain(
          feedbackItem.level
        );
      }
    });
  });

  describe('Multiple Test Scenarios', () => {
    const scenarios = [
      {
        name: 'hello_world',
        code: 'console.log("Hello World")',
        expected: 'Hello World',
        shouldPass: true,
      },
      {
        name: 'math_calculation',
        code: 'console.log(15 * 23)',
        expected: '345',
        shouldPass: true,
      },
      {
        name: 'fibonacci',
        code: `
function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
console.log(fib(7));
`,
        expected: '13',
        shouldPass: true,
      },
      {
        name: 'syntax_error',
        code: 'console.log("test"',
        expected: 'test',
        shouldPass: false,
      },
    ];

    for (const scenario of scenarios) {
      it(`should handle scenario: ${scenario.name}`, async () => {
        const result = await evaluator.evaluate(
          scenario.code,
          scenario.name,
          `Test: ${scenario.name}`,
          scenario.expected
        );

        expect(result.passed).toBe(scenario.shouldPass);
      });
    }
  });

  describe('Pass Threshold', () => {
    it('should pass at 70 points threshold', async () => {
      const result = await evaluator.evaluate(
        'console.log("test")',
        'threshold_test',
        'Print test',
        'completely_different_output_12345'
      );

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThanOrEqual(80);
      expect(result.passed).toBe(true);
    });
  });

  describe('Concurrent Evaluations', () => {
    it('should handle multiple evaluations', async () => {
      const codes = ['console.log(1)', 'console.log(2)', 'console.log(3)'];

      const results = await Promise.all(
        codes.map((code, i) =>
          evaluator.evaluate(code, `concurrent_${i}`, 'Print number')
        )
      );

      expect(results.every((r) => r.passed)).toBe(true);
      expect(results.length).toBe(3);
    });
  });

  describe('Large Output', () => {
    it('should handle large output', async () => {
      const code = `
for (let i = 0; i < 100; i++) {
  console.log(\`Line \${i}\`);
}
`;
      const result = await evaluator.evaluate(
        code,
        'large_output',
        'Print 100 lines'
      );

      expect(result.passed).toBe(true);
      expect(result.details.output).toBeDefined();
      expect(result.details.output!.length).toBeGreaterThan(0);
    });
  });

  describe('Code with Imports', () => {
    it('should handle code with standard library imports', async () => {
      const code = `
import * as path from 'path';
const result = path.join('a', 'b', 'c');
console.log(result);
`;
      const result = await evaluator.evaluate(
        code,
        'with_imports',
        'Join paths',
        'a/b/c'
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('Error Message Clarity', () => {
    it('should provide clear syntax error messages', async () => {
      const result = await evaluator.evaluate(
        'if (true',
        'syntax_clarity',
        'Test'
      );

      const errorMessages = result.feedback
        .filter((f) => f.level === 'error')
        .map((f) => f.message);

      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should provide clear runtime error messages', async () => {
      const result = await evaluator.evaluate(
        'const x: any = undefined; x.foo();',
        'runtime_clarity',
        'Test'
      );

      const errorMessages = result.feedback
        .filter((f) => f.level === 'error')
        .map((f) => f.message);

      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });
});

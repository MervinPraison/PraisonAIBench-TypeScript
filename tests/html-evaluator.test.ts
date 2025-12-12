/**
 * Tests for the HTML Evaluator
 */

import { HTMLEvaluator } from '../src/evaluators/html-evaluator';

describe('HTMLEvaluator', () => {
  let evaluator: HTMLEvaluator;

  beforeEach(() => {
    evaluator = new HTMLEvaluator();
  });

  describe('getLanguage', () => {
    it('should return "html"', () => {
      expect(evaluator.getLanguage()).toBe('html');
    });
  });

  describe('getFileExtension', () => {
    it('should return "html"', () => {
      expect(evaluator.getFileExtension()).toBe('html');
    });
  });

  describe('evaluate', () => {
    it('should evaluate valid HTML with DOCTYPE', async () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello World</h1></body>
</html>`;

      const result = await evaluator.evaluate(html, 'test_valid', 'Create HTML');

      expect(result.details.has_doctype).toBe(true);
      expect(result.details.has_required_tags).toBe(true);
      expect(result.feedback.some((f) => f.message.includes('DOCTYPE'))).toBe(true);
    });

    it('should detect missing DOCTYPE', async () => {
      const html = `<html>
<head><title>Test</title></head>
<body><h1>Hello World</h1></body>
</html>`;

      const result = await evaluator.evaluate(html, 'test_no_doctype', 'Create HTML');

      expect(result.details.has_doctype).toBe(false);
      expect(result.feedback.some((f) => f.message.includes('DOCTYPE'))).toBe(true);
    });

    it('should detect missing required tags', async () => {
      const html = `<!DOCTYPE html>
<div>Hello World</div>`;

      const result = await evaluator.evaluate(html, 'test_missing_tags', 'Create HTML');

      expect(result.details.has_doctype).toBe(true);
      expect(result.details.has_required_tags).toBe(false);
    });

    it('should extract HTML from markdown code block', async () => {
      const response = `Here is the HTML:

\`\`\`html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello</h1></body>
</html>
\`\`\``;

      const result = await evaluator.evaluate(response, 'test_markdown', 'Create HTML');

      expect(result.details.has_doctype).toBe(true);
      expect(result.details.has_required_tags).toBe(true);
    });

    it('should return score between 0 and 100', async () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Hello World</h1></body>
</html>`;

      const result = await evaluator.evaluate(html, 'test_score', 'Create HTML');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should include structure issues in details', async () => {
      const html = `<div>Just a div</div>`;

      const result = await evaluator.evaluate(html, 'test_issues', 'Create HTML');

      expect(result.details.structure_issues).toBeDefined();
      expect(result.details.structure_issues.length).toBeGreaterThan(0);
    });

    it('should handle empty HTML', async () => {
      const result = await evaluator.evaluate('', 'test_empty', 'Create HTML');

      expect(result.score).toBeLessThan(50);
      expect(result.passed).toBe(false);
    });
  });
});

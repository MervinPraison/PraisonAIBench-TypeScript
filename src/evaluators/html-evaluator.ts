/**
 * HTML Evaluator - Browser-based HTML/JavaScript evaluation
 *
 * Uses Playwright for real browser rendering, screenshot capture,
 * and console error detection.
 */

import { BaseEvaluator, EvaluationResult } from '../base-evaluator';
import * as fs from 'fs';
import * as path from 'path';

// Playwright types (optional dependency)
type Browser = {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
};

type Page = {
  setContent: (html: string) => Promise<void>;
  waitForLoadState: (state: string, options?: { timeout: number }) => Promise<void>;
  screenshot: (options: { path: string; fullPage: boolean }) => Promise<void>;
  on: (event: string, callback: (msg: unknown) => void) => void;
};

type ConsoleMessage = {
  type: () => string;
  text: () => string;
};

type Playwright = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<Browser>;
  };
};

export interface HTMLEvaluationResult extends EvaluationResult {
  details: {
    renders: boolean;
    errors: string[];
    warnings: string[];
    screenshot?: string;
    render_time_ms: number;
    has_doctype: boolean;
    has_required_tags: boolean;
    structure_issues: string[];
    [key: string]: unknown;
  };
}

/**
 * HTML/JavaScript evaluator using Playwright for browser testing.
 *
 * Scoring:
 * - Renders successfully: 50 points
 * - No console errors: 30 points
 * - Fast render (<3s): 20 points
 */
export class HTMLEvaluator extends BaseEvaluator {
  private headless: boolean;
  private outputDir: string;
  private playwrightAvailable: boolean = false;
  private playwright: Playwright | null = null;

  constructor(headless = true, outputDir = 'output/screenshots') {
    super();
    this.headless = headless;
    this.outputDir = outputDir;
    this.checkPlaywright();
  }

  private async checkPlaywright(): Promise<void> {
    try {
      // Dynamic import to make playwright optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pw = require('playwright') as Playwright;
      this.playwright = pw;
      this.playwrightAvailable = true;
    } catch {
      this.playwrightAvailable = false;
      // Silently fail - playwright is optional
    }
  }

  getLanguage(): string {
    return 'html';
  }

  getFileExtension(): string {
    return 'html';
  }

  /**
   * Extract HTML code from response (handles markdown code blocks).
   */
  private extractHTML(response: string): string {
    // Try to extract from HTML code block
    const htmlMatch = response.match(/```html\s*([\s\S]*?)```/i);
    if (htmlMatch) {
      return htmlMatch[1].trim();
    }

    // Try generic code block
    const codeMatch = response.match(/```\s*([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }

    // Return as-is if no code block
    return response.trim();
  }

  /**
   * Validate HTML structure statically.
   */
  private validateStructure(html: string): {
    score: number;
    has_doctype: boolean;
    has_required_tags: boolean;
    issues: string[];
  } {
    let score = 0;
    const issues: string[] = [];

    // DOCTYPE check (25 points)
    const hasDoctype = html.toUpperCase().includes('<!DOCTYPE');
    if (hasDoctype) {
      score += 25;
    } else {
      issues.push('Missing DOCTYPE declaration');
    }

    // Required tags check (25 points)
    const requiredTags = ['<html', '<head', '<body'];
    const htmlLower = html.toLowerCase();
    let foundTags = 0;

    for (const tag of requiredTags) {
      if (htmlLower.includes(tag)) {
        foundTags++;
      } else {
        issues.push(`Missing required tag: ${tag}>`);
      }
    }

    score += (foundTags / requiredTags.length) * 25;

    // Basic structure validation (50 points)
    // Check for matching tags
    const openTags = (html.match(/<[a-z][^>]*>/gi) || []).length;

    if (openTags > 0) {
      score += 50;
    } else {
      issues.push('No HTML tags found');
    }

    return {
      score: Math.round(score),
      has_doctype: hasDoctype,
      has_required_tags: foundTags === requiredTags.length,
      issues,
    };
  }

  /**
   * Evaluate HTML using browser (if Playwright available) or static validation.
   */
  async evaluate(
    code: string,
    testName: string,
    _prompt: string,
    _expected?: string
  ): Promise<HTMLEvaluationResult> {
    const html = this.extractHTML(code);
    const structureResult = this.validateStructure(html);

    const result: HTMLEvaluationResult = {
      score: 0,
      passed: false,
      feedback: [],
      details: {
        renders: false,
        errors: [],
        warnings: [],
        render_time_ms: 0,
        has_doctype: structureResult.has_doctype,
        has_required_tags: structureResult.has_required_tags,
        structure_issues: structureResult.issues,
      },
    };

    // Add structure feedback
    if (structureResult.has_doctype) {
      result.feedback.push({
        level: 'success',
        message: '✅ DOCTYPE declaration present',
      });
    } else {
      result.feedback.push({
        level: 'warning',
        message: '⚠️  Missing DOCTYPE declaration',
      });
    }

    if (structureResult.has_required_tags) {
      result.feedback.push({
        level: 'success',
        message: '✅ Required HTML tags present (html, head, body)',
      });
    } else {
      result.feedback.push({
        level: 'warning',
        message: '⚠️  Missing some required HTML tags',
      });
    }

    // Try browser evaluation if Playwright is available
    if (this.playwrightAvailable && this.playwright) {
      try {
        const browserResult = await this.evaluateInBrowser(html, testName);
        result.details.renders = browserResult.renders;
        result.details.errors = browserResult.errors;
        result.details.warnings = browserResult.warnings;
        result.details.screenshot = browserResult.screenshot;
        result.details.render_time_ms = browserResult.render_time_ms;

        // Calculate score based on browser evaluation
        let browserScore = 0;

        // Renders successfully: 50 points
        if (browserResult.renders) {
          browserScore += 50;
          result.feedback.push({
            level: 'success',
            message: '✅ HTML renders successfully in browser',
          });
        } else {
          result.feedback.push({
            level: 'error',
            message: '❌ HTML failed to render in browser',
          });
        }

        // No console errors: 30 points
        if (browserResult.errors.length === 0) {
          browserScore += 30;
          result.feedback.push({
            level: 'success',
            message: '✅ No console errors',
          });
        } else if (browserResult.errors.length <= 2) {
          browserScore += 15;
          result.feedback.push({
            level: 'warning',
            message: `⚠️  ${browserResult.errors.length} console error(s)`,
            details: browserResult.errors.join('; '),
          });
        } else {
          result.feedback.push({
            level: 'error',
            message: `❌ ${browserResult.errors.length} console errors`,
            details: browserResult.errors.slice(0, 3).join('; '),
          });
        }

        // Fast render: 20 points
        if (browserResult.render_time_ms > 0 && browserResult.render_time_ms < 1000) {
          browserScore += 20;
          result.feedback.push({
            level: 'success',
            message: `✅ Fast render time: ${browserResult.render_time_ms}ms`,
          });
        } else if (browserResult.render_time_ms < 3000) {
          browserScore += 10;
          result.feedback.push({
            level: 'info',
            message: `📊 Render time: ${browserResult.render_time_ms}ms`,
          });
        }

        if (browserResult.screenshot) {
          result.feedback.push({
            level: 'info',
            message: `📸 Screenshot saved: ${browserResult.screenshot}`,
          });
        }

        result.score = browserScore;
      } catch (error) {
        // Fall back to structure-only score
        result.score = Math.round(structureResult.score * 0.5); // 50% weight for structure only
        result.feedback.push({
          level: 'warning',
          message: `⚠️  Browser evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    } else {
      // Structure-only evaluation (50% weight)
      result.score = Math.round(structureResult.score * 0.5);
      result.feedback.push({
        level: 'info',
        message: '📊 Using static HTML validation (Playwright not available)',
      });
    }

    result.passed = result.score >= 70;
    result.overall_score = result.score;

    return result;
  }

  /**
   * Evaluate HTML in a real browser using Playwright.
   */
  private async evaluateInBrowser(
    html: string,
    testName: string
  ): Promise<{
    renders: boolean;
    errors: string[];
    warnings: string[];
    screenshot?: string;
    render_time_ms: number;
  }> {
    if (!this.playwright) {
      throw new Error('Playwright not available');
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let renders = false;
    let renderTime = 0;
    let screenshotPath: string | undefined;

    const browser = await this.playwright.chromium.launch({
      headless: this.headless,
    });

    try {
      const page = await browser.newPage();

      // Capture console messages
      page.on('console', (msg: unknown) => {
        const consoleMsg = msg as ConsoleMessage;
        if (consoleMsg.type && consoleMsg.type() === 'error') {
          errors.push(consoleMsg.text());
        } else if (consoleMsg.type && consoleMsg.type() === 'warning') {
          warnings.push(consoleMsg.text());
        }
      });

      page.on('pageerror', (err: unknown) => {
        errors.push(String(err));
      });

      // Load HTML and measure time
      const startTime = Date.now();
      await page.setContent(html);
      await page.waitForLoadState('networkidle', { timeout: 5000 });
      renderTime = Date.now() - startTime;
      renders = true;

      // Take screenshot
      fs.mkdirSync(this.outputDir, { recursive: true });
      screenshotPath = path.join(this.outputDir, `${testName}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      errors.push(`Browser error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }

    return {
      renders,
      errors,
      warnings,
      screenshot: screenshotPath,
      render_time_ms: renderTime,
    };
  }
}

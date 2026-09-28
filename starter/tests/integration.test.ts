import { describe, it, expect } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';

describe('Live Integration Test', () => {
  it.skip('runs an end-to-end code review against a real repository', async () => {
    const orchestrator = new CodeReviewOrchestrator();

    const report = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(typeof report.summary.overallScore).toBe('number');
  }, 120000);
});
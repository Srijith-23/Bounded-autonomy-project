import { describe, it, expect } from 'vitest';
import { ReviewReportSchema } from '../src/types/report-types.js';

describe('ReviewReportSchema Validation', () => {
  it('accepts a valid review report payload', () => {
    const validReport = {
      pullRequest: {
        owner: 'octocat',
        repo: 'Hello-World',
        number: 1,
      },

      fileReviews: [],

      summary: {
        totalFiles: 2,
        overallScore: 85,
        criticalIssues: 0,
        highPriorityTests: 1,
        refactoringOpportunities: 2,
      },

      recommendations: [],

      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: 1500,
        agentVersions: {
          codeQuality: '1.0.0',
          testCoverage: '1.0.0',
          refactoring: '1.0.0',
        },
      },
    };

    const result = ReviewReportSchema.safeParse(validReport);

    expect(result.success).toBe(true);
  });

  it('rejects an invalid review report payload missing required fields', () => {
    const invalidReport = {
      summary: {
        totalFiles: 'two',
      },
    };

    const result = ReviewReportSchema.safeParse(invalidReport);

    expect(result.success).toBe(false);
  });
});

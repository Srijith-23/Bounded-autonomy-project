import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

vi.mock('../src/utils/error-handler.js', async () => {
  const actual = await vi.importActual<typeof import('../src/utils/error-handler.js')>(
    '../src/utils/error-handler.js'
  );

  return {
    ...actual,
    withRetry: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
  };
});

import { CodeReviewOrchestrator } from '../src/orchestrator.js';

const validReport = {
  pullRequest: {
    owner: 'octocat',
    repo: 'Hello-World',
    number: 1,
  },
  fileReviews: [],
  summary: {
    totalFiles: 0,
    overallScore: 85,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 100,
    agentVersions: {
      codeQuality: '1.0.0',
      testCoverage: '1.0.0',
      refactoring: '1.0.0',
    },
  },
};

function mockSuccessfulQuery(report = validReport) {
  queryMock.mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'result',
        subtype: 'success',
        structured_output: report,
      };
    },
  });
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom rate limit configuration', () => {
      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: {
          tokensPerWindow: 100,
          windowMs: 1000,
        },
      });

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: {
          tokensPerWindow: 30000,
          windowMs: 60000,
        },
      });

      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(queryMock).toHaveBeenCalledTimes(1);

      const call = queryMock.mock.calls[0][0];

      expect(call.prompt).toContain('Review Pull Request #1');
      expect(call.prompt).toContain('octocat/Hello-World');

      expect(call.options.mcpServers).toBeDefined();
      expect(call.options.mcpServers.github).toBeDefined();
    });

    it('should spawn all 3 subagents in parallel', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: {
          tokensPerWindow: 30000,
          windowMs: 60000,
        },
      });

      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      const call = queryMock.mock.calls[0][0];

      expect(call.options.agents).toBeDefined();
      expect(call.options.agents['code-quality-analyzer']).toBeDefined();
      expect(call.options.agents['test-coverage-analyzer']).toBeDefined();
      expect(call.options.agents['refactoring-suggester']).toBeDefined();
    });

    it('should aggregate results into ReviewReport', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: {
          tokensPerWindow: 30000,
          windowMs: 60000,
        },
      });

      const report = await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(report.pullRequest.owner).toBe('octocat');
      expect(report.pullRequest.repo).toBe('Hello-World');
      expect(report.pullRequest.number).toBe(1);
      expect(report.summary.overallScore).toBe(85);
    });

    it('should validate output with Zod schema', async () => {
      mockSuccessfulQuery();

      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: {
          tokensPerWindow: 30000,
          windowMs: 60000,
        },
      });

      const report = await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(report).toEqual(validReport);
    });

    it('should reject invalid structured output', async () => {
      mockSuccessfulQuery({
        ...validReport,
        summary: {
          ...validReport.summary,
          overallScore: 'not-a-number' as unknown as number,
        },
      });

      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: {
          tokensPerWindow: 30000,
          windowMs: 60000,
        },
      });

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow(/schema validation/i);
    });
  });

  describe('Failure handling', () => {
    it('should surface SDK failures', async () => {
      queryMock.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'error_max_turns',
          };
        },
      });

      const orchestrator = new CodeReviewOrchestrator({
        rateLimiter: {
          acquire: async () => {},
          release: () => {},
        } as any,
      });

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow(/error_max_turns/i);
    }, 15000);
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      // Live integration is covered separately by integration.test.ts.
    });
  });
});

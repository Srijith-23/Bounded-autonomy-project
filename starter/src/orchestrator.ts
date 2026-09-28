import { query } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReportSchema, ReviewReportJSONSchema, ReviewReport } from './types/report-types.js';
import { logger } from './utils/logger.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from './utils/error-handler.js';
import { RateLimiter, globalRateLimiter, RateLimiterConfig } from './utils/rate-limiter.js';
import { codeQualityAnalyzer } from './agents/code-quality-analyzer.js';
import { testCoverageAnalyzer } from './agents/test-coverage-analyzer.js';
import { refactoringSuggester } from './agents/refactoring-suggester.js';
import { mcpServers } from './config/mcp.config.js';

const ORCHESTRATOR_TIMEOUT_MS = 15 * 60 * 1000; // per-file fan-out needs headroom
const DEFAULT_MAX_TURNS = 60; // multi-agent, multi-file coordination needs plenty of turns
const ESTIMATED_TOKENS_PER_REVIEW = 30000; // rough estimate for a multi-file, multi-agent run



const agents = {
  'code-quality-analyzer': codeQualityAnalyzer,
  'test-coverage-analyzer': testCoverageAnalyzer,
  'refactoring-suggester': refactoringSuggester,
};

function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `Review Pull Request #${prNumber} on ${owner}/${repo}.
Coordinate with sub-agents to analyze code quality, test coverage, and refactoring opportunities.
Produce a single valid JSON object matching the required schema.`;
}

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  /** Rate limiter to use for this orchestrator (defaults to the shared global instance) */
  rateLimiter?: RateLimiter;
  /** Convenience: build a dedicated rate limiter from a partial config instead of passing `rateLimiter` */
  rateLimitConfig?: Partial<RateLimiterConfig>;
  /** Override the model used (defaults to process.env.ANTHROPIC_MODEL) */
  model?: string;
  /** Override the max SDK turns allowed for a single review (default: 60) */
  maxTurns?: number;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly rateLimiter: RateLimiter;
  private readonly model?: string;
  private readonly maxTurns: number;

  constructor(options: OrchestratorOptions = {}) {
    this.rateLimiter =
      options.rateLimiter ?? (options.rateLimitConfig ? new RateLimiter(options.rateLimitConfig) : globalRateLimiter);
    this.model = options.model;
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const model = this.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022';

    const startedAt = Date.now();
    logger.info('Starting code review', { owner, repo, prNumber });

    await this.rateLimiter.acquire(ESTIMATED_TOKENS_PER_REVIEW);
    try {
      // Step 3 fix: Wrap execution with both retry logic and timeout helper
      const structuredOutput = await withRetry(() =>
        withTimeout(this.runQuery(owner, repo, prNumber, model), ORCHESTRATOR_TIMEOUT_MS)
      );

      const parsed = ReviewReportSchema.safeParse(structuredOutput);
      if (!parsed.success) {
        throw new ReviewError(
          `Orchestrator output failed schema validation: ${parsed.error.message}`,
          ErrorCodes.VALIDATION_ERROR,
          { issues: parsed.error.issues }
        );
      }

      const duration = Date.now() - startedAt;
      logger.info('Code review completed', {
        owner,
        repo,
        prNumber,
        score: parsed.data.summary.overallScore,
        duration,
        status: 'success',
      });

      return parsed.data;
    } catch (error) {
      logger.error('Code review failed', {
        owner,
        repo,
        prNumber,
        error: error instanceof Error ? error.message : String(error),
        status: 'failed',
      });
      throw error;
    } finally {
      this.rateLimiter.release();
    }
  }

  private async runQuery(
    owner: string,
    repo: string,
    prNumber: number,
    model: string
  ): Promise<unknown> {
    const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

    const result = await query({
      prompt,
      options: {
        model,
        maxTurns: this.maxTurns,
        permissionMode: 'default',
        mcpServers,
        agents,
        // Step 2 fix: Correctly namespace MCP server tools using mcp__<server>__*
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__*',
          'mcp__eslint__*',
        ],
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema as any,
        },
      },
    });

    let structuredOutput: unknown = null;
    let failureSubtype: string | null = null;

    for await (const message of result as any) {
      if (message.type === 'result') {
        if (message.subtype === 'success' && message.structured_output) {
          structuredOutput = message.structured_output;
        } else if (message.subtype !== 'success') {
          failureSubtype = message.subtype;
        }
      } else if (message.structured_output) {
        structuredOutput = message.structured_output;
      }

      if (message.type === 'assistant') {
        logger.debug('Orchestrator turn', { content: message.message?.content });
      }
    }

    if (!structuredOutput) {
      throw new ReviewError(
        failureSubtype
          ? `Orchestrator run ended with SDK failure subtype "${failureSubtype}"`
          : 'Orchestrator did not produce a structured_output payload',
        ErrorCodes.EXECUTION_FAILED,
        { owner, repo, prNumber, failureSubtype }
      );
    }

    return structuredOutput;
  }
}
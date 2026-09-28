import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Evaluates test coverage gaps, identifies untested functions/methods, and suggests specific test cases with assertions.',
  model: 'inherit',
  tools: ['ReadFile', 'SearchCode'],
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
};
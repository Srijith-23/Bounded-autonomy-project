import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description: 'Analyzes code for security vulnerabilities, performance issues, and maintainability concerns.',
  model: 'inherit',
  tools: ['ReadFile', 'SearchCode', 'Skill'],
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
};
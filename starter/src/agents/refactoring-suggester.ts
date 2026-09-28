import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';
export const refactoringSuggester: AgentDefinition = {
  description: 'Identifies opportunities to apply modern language features, design patterns, extract candidate functions, and remove redundant code.',
  model: 'inherit',
  tools: ['ReadFile', 'SearchCode'],
  prompt: REFACTORING_SUGGESTER_PROMPT,
};
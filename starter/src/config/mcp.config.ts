import { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

export const mcpServers: Record<string, McpServerConfig> = {
  github: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
    },
  },
  eslint: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-eslint'],
    env: {},
  },
};
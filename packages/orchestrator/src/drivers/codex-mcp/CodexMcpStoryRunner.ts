import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import pRetry, { AbortError } from 'p-retry';
import pTimeout from 'p-timeout';

import { isRecord } from '../../internal/guards.js';
import type { ResolvedWorkflowConfig } from '../../types.js';
import type { DriverToolStatus, StoryRunner, StoryRunRequest, StoryRunResult } from '../StoryRunner.js';
import { type McpTool, validateCodexToolSchemas } from './schemaValidation.js';
import { buildCodexToolInput } from './toolInput.js';

const VERSION = '0.1.0';
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60 * 60 * 1000;
const RETRIES = 2;

type CodexMcpClient = Pick<Client, 'connect' | 'callTool' | 'listTools' | 'close'>;

export interface CodexMcpStoryRunnerOptions {
  startupTimeoutMs?: number;
  requestTimeoutMs?: number;
  retries?: number;
  createClient?: () => { client: CodexMcpClient; transport: StdioClientTransport };
}

export class CodexMcpStoryRunner implements StoryRunner {
  constructor(
    private readonly config: ResolvedWorkflowConfig,
    private readonly options: CodexMcpStoryRunnerOptions = {},
  ) {}

  async runStory(request: StoryRunRequest): Promise<StoryRunResult> {
    return await this.withClient(async (client) => {
      const invocation = buildCodexToolInput(this.config, request.story, request.prompt);
      const requestTimeoutMs = this.options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
      const totalTimeoutMs = Math.min(requestTimeoutMs, this.config.orchestrator.childTimeoutMs);
      const rawResult = await pTimeout(
        client.callTool(
          {
            name: 'codex',
            arguments: invocation as unknown as Record<string, unknown>,
          },
          undefined,
          {
            timeout: requestTimeoutMs,
            resetTimeoutOnProgress: true,
            maxTotalTimeout: totalTimeoutMs,
          },
        ),
        {
          milliseconds: totalTimeoutMs,
          message: 'Codex MCP request timed out',
        },
      );

      if (isToolError(rawResult)) {
        throw new AbortError(extractContent(rawResult) || 'Codex MCP returned a tool error');
      }

      const output = validateCodexToolOutput(rawResult);
      return {
        storyId: request.story.id,
        sessionId: output.threadId,
        content: output.content,
        rawResult,
        invocation: invocation as unknown as Record<string, unknown>,
      };
    });
  }

  async checkTools(): Promise<DriverToolStatus> {
    return await this.withClient(async (client) => {
      const startupTimeoutMs = this.options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
      const result = await pTimeout(
        client.listTools(
          {},
          {
            timeout: startupTimeoutMs,
            maxTotalTimeout: startupTimeoutMs,
          },
        ),
        {
          milliseconds: startupTimeoutMs,
          message: 'Codex MCP tools/list timed out',
        },
      );
      const tools = validateListToolsResult(result);
      validateCodexToolSchemas(tools);
      return { ok: true, tools: tools.map((tool) => tool.name) };
    });
  }

  private async withClient<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    return await pRetry(
      async () => {
        const { client, transport } = this.createClient();
        try {
          await pTimeout(client.connect(transport), {
            milliseconds: this.options.startupTimeoutMs ?? STARTUP_TIMEOUT_MS,
            message: 'Codex MCP startup timed out',
          });
          return await operation(client as Client);
        } catch (error) {
          if (error instanceof AbortError) throw error;
          if (isTransientError(error)) throw error;
          throw new AbortError(error instanceof Error ? error : new Error(String(error)));
        } finally {
          await client.close();
        }
      },
      {
        retries: this.options.retries ?? RETRIES,
      },
    );
  }

  private createClient(): { client: CodexMcpClient; transport: StdioClientTransport } {
    if (this.options.createClient) return this.options.createClient();
    const client = new Client({
      name: 'agentic-workflow-kit-orchestrator',
      version: VERSION,
    });
    const transport = new StdioClientTransport({
      command: 'codex',
      args: ['mcp-server'],
      cwd: this.config.workspace.rootAbs,
      stderr: 'inherit',
    });
    return { client, transport };
  }
}

interface CodexToolOutput {
  threadId: string;
  content: string;
}

function validateCodexToolOutput(value: unknown): CodexToolOutput {
  if (!isRecord(value)) throw new AbortError('Codex MCP result must be an object');
  if (!isRecord(value.structuredContent)) throw new AbortError('Codex MCP result missing structuredContent');
  const { threadId, content } = value.structuredContent;
  if (typeof threadId !== 'string' || threadId.length === 0) {
    throw new AbortError('Codex MCP result missing structuredContent.threadId');
  }
  if (typeof content !== 'string') {
    throw new AbortError('Codex MCP result missing structuredContent.content');
  }
  return { threadId, content };
}

function validateListToolsResult(value: unknown): McpTool[] {
  if (!isRecord(value) || !Array.isArray(value.tools)) {
    throw new AbortError('MCP tools/list result must contain a tools array');
  }
  return value.tools.map((tool, index) => {
    if (!isRecord(tool) || typeof tool.name !== 'string' || !isRecord(tool.inputSchema)) {
      throw new AbortError(`MCP tool ${index} is malformed`);
    }
    return tool as McpTool;
  });
}

function isToolError(value: unknown): boolean {
  return isRecord(value) && value.isError === true;
}

function extractContent(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.content)) return '';
  return value.content
    .filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => (block as { text: string }).text)
    .join('\n');
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Retry only connect/startup transients. Request timeouts can represent a full story run,
  // and ENOENT means the codex binary is missing, so both must fail without retry.
  return /(startup|connect|connection|ECONN)/i.test(error.message);
}

import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import pRetry, { AbortError } from 'p-retry';
import pTimeout from 'p-timeout';

import { isRecord } from '../../internal/guards.js';
import { controlChild } from '../../mcp/codexControl.js';
import type { ChildResultEvidence, ResolvedWorkflowConfig } from '../../types.js';
import type {
  ChildControlRequest,
  ChildControlResult,
  ChildProgressSource,
  DriverErrorClassification,
  DriverToolStatus,
  StoryPromptMetadata,
  StoryRunner,
  StoryRunRequest,
  StoryRunResult,
} from '../StoryRunner.js';
import { codexProgressMessage, parseCodexEventNotification } from './codexEvents.js';
import { childResultEvidence } from './evidenceParser.js';
import { type McpTool, validateCodexToolSchemas } from './schemaValidation.js';
import { codexSessionLogRoots } from './sessionLogs.js';
import { buildCodexToolInput, codexDriverCapabilityDowngrades } from './toolInput.js';

const VERSION = '0.1.0';
const STARTUP_TIMEOUT_MS = 30_000;
const RETRIES = 2;

type CodexMcpClient = Pick<Client, 'connect' | 'callTool' | 'listTools' | 'close' | 'fallbackNotificationHandler'>;

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
      request.signal?.throwIfAborted();
      const invocation = buildCodexToolInput(
        this.config,
        request.story,
        request.prompt,
        request.cwd,
        request.profile,
        request.promptMetadata,
      );
      const capabilityDowngrades = codexDriverCapabilityDowngrades(request.promptMetadata);
      const requestTimeoutMs = this.options.requestTimeoutMs ?? this.config.orchestrator.childMaxRuntimeMs;
      const totalTimeoutMs =
        this.options.requestTimeoutMs === undefined
          ? this.config.orchestrator.childMaxRuntimeMs
          : Math.min(this.options.requestTimeoutMs, this.config.orchestrator.childMaxRuntimeMs);
      const linkedSessionIds = new Set<string>();
      let codexEventRequestId: string | number | null = null;
      const reportSessionLinked = async (
        sessionId: string,
        sessionLogPath: string | null,
        progressSource: ChildProgressSource,
      ): Promise<void> => {
        if (request.signal?.aborted) return;
        if (linkedSessionIds.has(sessionId)) return;
        linkedSessionIds.add(sessionId);
        await request.onLifecycle?.({ type: 'session-linked', sessionId, sessionLogPath, progressSource });
      };
      const previousFallbackNotificationHandler = client.fallbackNotificationHandler;
      client.fallbackNotificationHandler = async (notification) => {
        await previousFallbackNotificationHandler?.(notification);
        if (request.signal?.aborted) return;
        const event = parseCodexEventNotification(notification);
        if (event === null) return;
        if (!matchesCodexEventRequest(event.requestId, codexEventRequestId)) return;
        if (linkedSessionIds.size === 0) {
          if (event.eventType === 'session_configured') {
            if (event.threadId === null || event.cwd === null || !samePath(event.cwd, request.cwd)) return;
            codexEventRequestId = event.requestId ?? codexEventRequestId;
            await reportSessionLinked(event.threadId, event.sessionLogPath, 'codex-event');
          } else if (event.eventType !== 'warning') {
            return;
          }
        } else {
          if (event.threadId !== null && !linkedSessionIds.has(event.threadId)) return;
          codexEventRequestId = event.requestId ?? codexEventRequestId;
          if (event.eventType === 'session_configured' && event.threadId !== null) {
            await reportSessionLinked(event.threadId, event.sessionLogPath, 'codex-event');
          }
        }
        if (event.threadId !== null || event.eventType === 'warning') {
          await request.onLifecycle?.({
            type: 'progress',
            message: codexProgressMessage(event),
            progressSource: 'codex-event',
            eventType: event.eventType,
            journal: shouldJournalCodexEvent(event.eventType),
          });
        }
      };
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
            signal: request.signal,
            onprogress: (progress: unknown) => {
              if (request.signal?.aborted) return;
              const sessionId = progressSessionId(progress);
              if (sessionId) void reportSessionLinked(sessionId, null, 'mcp-progress');
              void request.onLifecycle?.({
                type: 'progress',
                message: progressMessage(progress),
                progressToken: progressToken(progress),
                progressSource: 'mcp-progress',
              });
            },
          },
        ),
        {
          milliseconds: totalTimeoutMs,
          message: 'Codex MCP request timed out',
        },
      );
      request.signal?.throwIfAborted();

      if (isToolError(rawResult)) {
        throw new AbortError(extractContent(rawResult) || 'Codex MCP returned a tool error');
      }

      const output = validateCodexToolOutput(rawResult);
      await reportSessionLinked(output.threadId, null, 'structured');
      const evidence = mergeDriverEvidence(output.evidence, request, capabilityDowngrades);
      return {
        storyId: request.story.id,
        sessionId: output.threadId,
        content: output.content,
        evidence,
        capabilityDowngrades,
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

  async controlChild(request: ChildControlRequest): Promise<ChildControlResult> {
    return await controlChild(request);
  }

  async abort(request: ChildControlRequest): Promise<ChildControlResult> {
    return await controlChild({ ...request, kind: 'interrupt' });
  }

  classifyError(error: unknown): DriverErrorClassification {
    const message = error instanceof Error ? error.message : String(error);
    const supervisionLost = /child-(?:no-progress|max-runtime)-timeout|child-timeout|Codex MCP request timed out/i.test(
      message,
    );
    return { supervisionLost, recoverable: supervisionLost };
  }

  describeCapabilityDowngrades(
    promptMetadata?: StoryPromptMetadata,
  ): ReturnType<typeof codexDriverCapabilityDowngrades> {
    return codexDriverCapabilityDowngrades(promptMetadata);
  }

  discoverSessionLogs(): string[] {
    return codexSessionLogRoots();
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

function mergeDriverEvidence(
  evidence: ChildResultEvidence | undefined,
  request: StoryRunRequest,
  capabilityDowngrades: ReturnType<typeof codexDriverCapabilityDowngrades>,
): ChildResultEvidence | undefined {
  if (!request.profile || !request.promptMetadata) return evidence;
  return {
    ...evidence,
    profile: {
      name: request.profile.name,
      taskType: request.profile.taskType,
    },
    prompt: {
      template: request.promptMetadata.template,
      hash: request.promptMetadata.promptHash,
    },
    structuredOutput: {
      schema: request.promptMetadata.structuredOutputSchema,
      required: request.promptMetadata.structuredOutputRequired,
      enforced: false,
    },
    capabilityDowngrades,
  };
}

function matchesCodexEventRequest(
  eventRequestId: string | number | null,
  codexEventRequestId: string | number | null,
): boolean {
  return codexEventRequestId === null || eventRequestId === null || eventRequestId === codexEventRequestId;
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}

function shouldJournalCodexEvent(eventType: string): boolean {
  return (
    eventType === 'mcp_startup_complete' ||
    eventType === 'exec_command_begin' ||
    eventType === 'exec_command_end' ||
    eventType === 'task_complete' ||
    eventType === 'warning'
  );
}

interface CodexToolOutput {
  threadId: string;
  content: string;
  evidence?: ChildResultEvidence;
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
  return { threadId, content, evidence: childResultEvidence(value.structuredContent, content) };
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

function progressMessage(value: unknown): string {
  if (!isRecord(value)) return 'Codex MCP progress';
  const message = value.message;
  if (typeof message === 'string' && message.length > 0) return message;
  const progress = value.progress;
  if (typeof progress === 'string' && progress.length > 0) return progress;
  return 'Codex MCP progress';
}

function progressToken(value: unknown): string | number | null {
  if (!isRecord(value)) return null;
  const token = value.progressToken ?? value.progress;
  return typeof token === 'string' || typeof token === 'number' ? token : null;
}

function progressSessionId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const direct = value.threadId ?? value.sessionId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  if (isRecord(value.structuredContent)) {
    const nested = value.structuredContent.threadId ?? value.structuredContent.sessionId;
    if (typeof nested === 'string' && nested.length > 0) return nested;
  }
  if (isRecord(value.metadata)) {
    const nested = value.metadata.threadId ?? value.metadata.sessionId;
    if (typeof nested === 'string' && nested.length > 0) return nested;
  }
  return null;
}

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Retry only connect/startup transients. Request timeouts can represent a full story run,
  // and ENOENT means the codex binary is missing, so both must fail without retry.
  return /(startup|connect|connection|ECONN)/i.test(error.message);
}

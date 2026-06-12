import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import pRetry, { AbortError } from 'p-retry';
import pTimeout from 'p-timeout';

import { isRecord } from '../../internal/guards.js';
import type { ChildResultEvidence, ResolvedWorkflowConfig, VerificationEvidence } from '../../types.js';
import type {
  ChildProgressSource,
  DriverToolStatus,
  StoryRunner,
  StoryRunRequest,
  StoryRunResult,
} from '../StoryRunner.js';
import { codexProgressMessage, parseCodexEventNotification } from './codexEvents.js';
import { type McpTool, validateCodexToolSchemas } from './schemaValidation.js';
import { buildCodexToolInput } from './toolInput.js';

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
      const invocation = buildCodexToolInput(this.config, request.story, request.prompt, request.cwd);
      const requestTimeoutMs = this.options.requestTimeoutMs ?? this.config.orchestrator.childNoProgressTimeoutMs;
      const totalTimeoutMs =
        this.options.requestTimeoutMs === undefined
          ? this.config.orchestrator.childMaxRuntimeMs
          : Math.min(this.options.requestTimeoutMs, this.config.orchestrator.childMaxRuntimeMs);
      const linkedSessionIds = new Set<string>();
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
        if (event.eventType === 'session_configured' && event.threadId !== null) {
          await reportSessionLinked(event.threadId, event.sessionLogPath, 'codex-event');
        }
        if (event.threadId !== null || event.eventType === 'warning') {
          await request.onLifecycle?.({
            type: 'progress',
            message: codexProgressMessage(event),
            progressSource: 'codex-event',
            eventType: event.eventType,
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
      return {
        storyId: request.story.id,
        sessionId: output.threadId,
        content: output.content,
        evidence: output.evidence,
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

function childResultEvidence(structuredContent: Record<string, unknown>, content: string): ChildResultEvidence {
  const structured =
    readEvidenceObject(structuredContent.childResult) ??
    readEvidenceObject(structuredContent.result) ??
    readEvidenceObject(structuredContent.evidence) ??
    readEvidenceObject(structuredContent);
  return mergeEvidence(compatibilityEvidence(content), structured);
}

function readEvidenceObject(value: unknown): ChildResultEvidence | null {
  if (!isRecord(value)) return null;
  const evidence: ChildResultEvidence = {};
  const storyId = readString(value.storyId);
  const finalStatus = readString(value.finalStatus) ?? readString(value.status);
  const trackerPath = readString(value.trackerPath);
  const trackerStatusEvidence = readString(value.trackerStatusEvidence);
  const prNumber = readNumber(value.prNumber);
  const prUrl = readString(value.prUrl);
  const merged = readBoolean(value.merged);
  const mergedAt = readString(value.mergedAt);
  const mergeCommit = readString(value.mergeCommit);
  const branchDeleted = readBoolean(value.branchDeleted);
  const verification = readVerification(value.verification);
  const downgrades = readStringArray(value.downgrades);
  if (storyId) evidence.storyId = storyId;
  if (finalStatus) evidence.finalStatus = finalStatus;
  if (trackerPath) evidence.trackerPath = trackerPath;
  if (trackerStatusEvidence) evidence.trackerStatusEvidence = trackerStatusEvidence;
  if (prNumber !== null) evidence.prNumber = prNumber;
  if (prUrl) evidence.prUrl = prUrl;
  if (merged !== null) evidence.merged = merged;
  if (mergedAt) evidence.mergedAt = mergedAt;
  if (mergeCommit) evidence.mergeCommit = mergeCommit;
  if (branchDeleted !== null) evidence.branchDeleted = branchDeleted;
  if (verification.length > 0) evidence.verification = verification;
  if (isRecord(value.prePrReview)) evidence.prePrReview = value.prePrReview;
  if (isRecord(value.prReview)) evidence.prReview = value.prReview;
  if (downgrades.length > 0) evidence.downgrades = downgrades;
  return Object.keys(evidence).length > 0 ? evidence : null;
}

function compatibilityEvidence(content: string): ChildResultEvidence {
  const evidence: ChildResultEvidence = {};
  const prUrl = content.match(/https:\/\/github\.com\/[^\s)]+\/pull\/(\d+)/);
  if (prUrl) {
    evidence.prUrl = prUrl[0];
    evidence.prNumber = Number(prUrl[1]);
  }
  const mergeCommit = content.match(/\b(?:Merged|merge commit|squash commit)[^`0-9a-f]*`?([0-9a-f]{7,40})`?/i);
  if (mergeCommit) {
    evidence.merged = true;
    evidence.mergeCommit = mergeCommit[1];
  } else if (/\bmerged\b/i.test(content) && evidence.prNumber !== undefined) {
    evidence.merged = true;
  }
  if (/remote story branch (?:was )?deleted|branch deletion confirmed/i.test(content)) {
    evidence.branchDeleted = true;
  }
  const trackerAuthority = content.match(/Tracker authority:\s*`?([^`\n]+)`?[^.\n]*(?:marked|has)\s+([a-z_-]+)/i);
  if (trackerAuthority) {
    evidence.trackerPath = trackerAuthority[1].trim();
    evidence.finalStatus = trackerAuthority[2].toLowerCase();
    evidence.trackerStatusEvidence = trackerAuthority[0];
  }
  const verification = verificationFromContent(content);
  if (verification.length > 0) evidence.verification = verification;
  const downgrades = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /downgraded|unavailable/i.test(line));
  if (downgrades.length > 0) evidence.downgrades = downgrades;
  return evidence;
}

function verificationFromContent(content: string): VerificationEvidence[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /`[^`]+`/.test(line) && /\bpassed\b/i.test(line))
    .map((line) => ({
      command: line.match(/`([^`]+)`/)?.[1] ?? null,
      status: 'passed' as const,
      detail: line,
    }));
}

function mergeEvidence(left: ChildResultEvidence, right: ChildResultEvidence | null): ChildResultEvidence {
  return right ? { ...left, ...right } : left;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readVerification(value: unknown): VerificationEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): VerificationEvidence[] => {
    if (typeof entry === 'string') return [{ command: entry, status: 'passed' }];
    if (!isRecord(entry)) return [];
    const status = readString(entry.status);
    if (status !== 'passed' && status !== 'failed' && status !== 'skipped') return [];
    return [
      {
        command: readString(entry.command),
        status,
        phase: readString(entry.phase),
        detail: readString(entry.detail),
      },
    ];
  });
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

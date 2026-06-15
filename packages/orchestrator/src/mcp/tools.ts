import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  projectInspectFacade,
  runExportFacade,
  runInspectFacade,
  runPreviewFacade,
  runReportFacade,
  runStatusFacade,
  runStreamFacade,
  trackerMigrateFacade,
  trackerValidateFacade,
} from '../api/facade.js';
import {
  abortRunHandler,
  analyzeRunHandler,
  listEligibleHandler,
  listStoriesHandler,
  listTracksHandler,
  mcpCheckHandler,
  pollWatchRunHandler,
  runWorkflowHandler,
  startWatchRunHandler,
  stopWatchRunHandler,
  watchRunHandler,
} from '../commands/handlers.js';
import { sendCodexInterrupt, sendCodexReply } from './codexControl.js';
import {
  assertWorkflowRepoContext,
  conciseAnalysisContent,
  controlConfiguredChild,
  handleTool,
  noopStdout,
  nullLogger,
  registerWorkflowResources,
  summarizeAnalysis,
  summarizeRun,
  toOverrides,
} from './toolHelpers.js';

export const ORCHESTRATOR_MCP_TOOLS = [
  'workflow_project_inspect',
  'workflow_run_preview',
  'workflow_run_status',
  'workflow_run_stream',
  'workflow_run_inspect',
  'workflow_run_report',
  'workflow_run_export',
  'workflow_run_control',
  'workflow_child_reply',
  'workflow_child_interrupt',
  'workflow_driver_check',
  'workflow_tracker_validate',
  'workflow_tracker_migrate',
  'list_tracks',
  'list_stories',
  'list_eligible',
  'run_eligible',
  'run_story',
  'watch_run',
  'watch_run_start',
  'watch_run_poll',
  'watch_run_stop',
  'codex_reply',
  'codex_interrupt',
  'analyze_run',
  'check_codex_mcp',
] as const;

const productBaseInputSchema = z.object({
  cwd: z
    .string()
    .optional()
    .describe('Target repo root to operate in; omit only when the MCP session is already running from that repo.'),
  configPath: z.string().optional().describe('Path to .workflow/config.yaml; defaults to <cwd>/.workflow/config.yaml.'),
  requestId: z.string().optional().describe('Optional client request id echoed in the WorkflowKit API envelope.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

function baseProductTrackerInputSchema() {
  return productBaseInputSchema.extend({
    track: z.string().describe('Track id containing the tracker to validate or use as migration target.'),
  });
}

const workflowRunPreviewInputSchema = productBaseInputSchema.extend({
  target: z
    .discriminatedUnion('type', [
      z.object({
        type: z.literal('story'),
        trackId: z.string().optional().describe('Track id containing the story.'),
        storyId: z.string().describe('Story id to preview.'),
      }),
      z.object({
        type: z.literal('track'),
        trackId: z.string().optional().describe('Track id to preview.'),
        mode: z.literal('eligible').describe('Preview the eligible-story track run.'),
      }),
    ])
    .describe('Product target for the run preview.'),
});

const workflowRunControlInputSchema = productBaseInputSchema.extend({
  runPath: z.string().describe('Absolute path to the run artifact directory to control.'),
  action: z.literal('abort').describe('Run control action to apply.'),
  storyId: z.string().optional().describe('Optional active story id to target within the run.'),
  reason: z.string().optional().describe('Operator-facing reason for the control request.'),
});

const workflowRunReadInputSchema = productBaseInputSchema.extend({
  runId: z.string().optional().describe('Run id under the configured artifact root.'),
  runPath: z.string().optional().describe('Absolute path to a run artifact directory.'),
  limit: z.number().int().positive().max(200).optional().describe('Maximum recent events to include.'),
});

const workflowRunStreamInputSchema = workflowRunReadInputSchema.extend({
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum stream duration before returning a timeout summary.'),
  intervalMs: z.number().int().positive().optional().describe('Polling interval while waiting for new run events.'),
});

const workflowRunReportInputSchema = workflowRunReadInputSchema.extend({
  format: z.enum(['json', 'markdown']).optional().describe('Report output format.'),
  sessionRoot: z.string().optional().describe('Override root for child session artifacts when analyzing a run.'),
});

const workflowRunExportInputSchema = workflowRunReadInputSchema.extend({
  out: z.string().optional().describe('Output directory for the bounded export bundle.'),
  include: z
    .enum(['summary', 'full-bounded'])
    .optional()
    .describe('Export mode. summary omits the event log; full-bounded includes approved artifacts with byte ceilings.'),
  sessionRoot: z
    .string()
    .optional()
    .describe('Override root for child session artifacts when generating report files.'),
});

const workflowTrackerValidateInputSchema = baseProductTrackerInputSchema();

const workflowTrackerMigrateInputSchema = baseProductTrackerInputSchema().extend({
  from: z.string().describe('Markdown backlog or tracker source file to import without mutating it in place.'),
});

const baseInputSchema = z.object({
  cwd: z
    .string()
    .optional()
    .describe('Target repo root to operate in; omit only when the MCP session is already running from that repo.'),
  configPath: z.string().optional().describe('Path to .workflow/config.yaml; defaults to <cwd>/.workflow/config.yaml.'),
  track: z
    .string()
    .optional()
    .describe('Track id to scope to; required for run_eligible when multiple tracks have eligible stories.'),
  tracksDir: z
    .string()
    .optional()
    .describe('Tracker directory override relative to the workspace root; defaults to paths.tracksDir from config.'),
  maxParallel: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum stories to dispatch or preview from eligible stories; defaults to the configured maxParallel.'),
  json: z.boolean().optional().describe('Prefer machine-readable CLI-compatible JSON formatting in text summaries.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const runInputSchema = baseInputSchema.extend({
  dryRun: z
    .boolean()
    .optional()
    .describe('Defaults to true. Set false only when the user explicitly approves launching child sessions.'),
  confirmNonDryRun: z
    .boolean()
    .optional()
    .describe('Required with dryRun false to explicitly approve launching non-dry-run child sessions.'),
  force: z.boolean().optional().describe('Allow dispatch even when the selected story is not currently eligible.'),
  childTimeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout in milliseconds for each child Codex MCP session.'),
  model: z.string().optional().describe('Optional Codex model override for child sessions.'),
  reasoning: z.string().optional().describe('Optional reasoning effort override for child sessions.'),
  approvalPolicy: z
    .enum(['never', 'on-failure', 'on-request', 'untrusted'])
    .optional()
    .describe('Child Codex approval policy; never means no interactive approval prompts.'),
  sandbox: z
    .enum(['danger-full-access', 'read-only', 'workspace-write'])
    .optional()
    .describe('Child Codex filesystem sandbox; danger-full-access grants full local disk access.'),
});

const runStoryInputSchema = runInputSchema.extend({
  storyId: z.string().describe('Tracker story id to dry-run or dispatch, for example WK4.'),
});

const runPathInputSchema = z.object({
  runPath: z
    .string()
    .describe('Absolute path to a run artifact directory, e.g. the artifactDir returned by run_story or run_eligible.'),
  sessionRoot: z.string().optional().describe('Override root for child session artifacts when analyzing a run.'),
  wait: z.boolean().optional().describe('For watch_run, poll until the run leaves running or timeoutMs expires.'),
  intervalMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For watch_run --wait, polling interval in milliseconds.'),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('For watch_run --wait, maximum wait time in milliseconds.'),
  json: z.boolean().optional().describe('Prefer machine-readable CLI-compatible JSON formatting in text summaries.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const watchRunPollInputSchema = runPathInputSchema.extend({
  cursor: z
    .object({
      eventOffset: z.number().int().nonnegative().describe('Number of run events the caller has already consumed.'),
    })
    .describe('Cursor returned by watch_run_start or a previous watch_run_poll call.'),
});

const watchRunStopInputSchema = z.object({
  watchId: z.string().describe('Watch id returned by watch_run_start.'),
  responseFormat: z
    .enum(['concise', 'detailed'])
    .optional()
    .describe('Structured response size. Use concise by default; detailed raises limits but may still truncate.'),
});

const childControlBaseInputSchema = productBaseInputSchema.extend({
  sessionId: z.string().optional().describe('Direct child session/thread id to control.'),
  runPath: z.string().optional().describe('Run artifact directory used with storyId to resolve a child session.'),
  storyId: z.string().optional().describe('Story id used with runPath to resolve children/<story>.launch.json.'),
});

const codexReplyInputSchema = childControlBaseInputSchema.extend({
  message: z.string().min(1).describe('Reply message to send to the live Codex child session.'),
});

const codexInterruptInputSchema = childControlBaseInputSchema.extend({
  reason: z.string().optional().describe('Optional operator-facing reason for interrupting the child session.'),
});

const outputSchema = z
  .object({
    truncated: z.boolean().optional().describe('True when structuredContent was shortened for MCP response safety.'),
    truncation: z
      .object({
        message: z.string().describe('Human-readable truncation summary.'),
        paths: z.array(z.string()).describe('StructuredContent paths that were truncated.'),
      })
      .optional()
      .describe('Present when structuredContent was shortened.'),
  })
  .passthrough();

export function registerOrchestratorTools(server: McpServer): void {
  registerWorkflowResources(server);

  server.registerTool(
    'workflow_project_inspect',
    {
      description: 'Resolve WorkflowKit project context, tracks, and capability flags using the product API envelope.',
      inputSchema: productBaseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_project_inspect', input.responseFormat, () => {
        return projectInspectFacade(toOverrides(input));
      }),
  );

  server.registerTool(
    'workflow_run_preview',
    {
      description:
        'Preview story or track execution through the product API envelope. This is non-mutating runtime preview behavior and keeps legacy run_story/run_eligible tools available.',
      inputSchema: workflowRunPreviewInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_run_preview', input.responseFormat, () => {
        return runPreviewFacade({ ...toOverrides(input), target: input.target });
      }),
  );

  server.registerTool(
    'workflow_run_status',
    {
      description: 'Read a bounded product status snapshot for a run from WorkflowKit run artifacts.',
      inputSchema: workflowRunReadInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_run_status', input.responseFormat, () =>
        runStatusFacade({
          ...toOverrides(input),
          runId: input.runId,
          runPath: input.runPath,
          events: { limit: input.limit },
        }),
      ),
  );

  server.registerTool(
    'workflow_run_stream',
    {
      description:
        'Replay a bounded run event tail, emit standard MCP progress notifications when available, and return a terminal or timeout stream summary.',
      inputSchema: workflowRunStreamInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input, extra) =>
      handleTool('workflow_run_stream', input.responseFormat, () =>
        runStreamFacade({
          ...toOverrides(input),
          runId: input.runId,
          runPath: input.runPath,
          subscription: {
            replay: { lastEvents: input.limit },
            timeoutMs: input.timeoutMs,
            pollIntervalMs: input.intervalMs,
          },
          onProgress:
            extra._meta?.progressToken === undefined
              ? undefined
              : async (event, delivered) => {
                  const progressToken = extra._meta?.progressToken;
                  if (progressToken === undefined) return;
                  await extra.sendNotification({
                    method: 'notifications/progress',
                    params: {
                      progressToken,
                      progress: delivered,
                      message: event.message,
                    },
                  });
                },
        }),
      ),
  );

  server.registerTool(
    'workflow_run_inspect',
    {
      description: 'Inspect a bounded run artifact/session/PR index without copying transcripts.',
      inputSchema: workflowRunReadInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_run_inspect', input.responseFormat, () =>
        runInspectFacade({ ...toOverrides(input), runId: input.runId, runPath: input.runPath }),
      ),
  );

  server.registerTool(
    'workflow_run_report',
    {
      description:
        'Generate or read a human-readable and machine-readable run report. Writes analysis.json and report.md only when this explicit report operation is called.',
      inputSchema: workflowRunReportInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_run_report', input.responseFormat, () =>
        runReportFacade({ ...toOverrides(input), runId: input.runId, runPath: input.runPath }),
      ),
  );

  server.registerTool(
    'workflow_run_export',
    {
      description:
        'Create a bounded shareable run artifact bundle. Host transcript paths stay path-only and transcript contents are not copied.',
      inputSchema: workflowRunExportInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (input) =>
      handleTool('workflow_run_export', input.responseFormat, () =>
        runExportFacade({ ...toOverrides(input), runId: input.runId, runPath: input.runPath, include: input.include }),
      ),
  );

  server.registerTool(
    'workflow_run_control',
    {
      description: 'Append a durable run control request and apply supported run-level controls. V1 supports abort.',
      inputSchema: workflowRunControlInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) =>
      handleTool('workflow_run_control', input.responseFormat, () =>
        abortRunHandler({
          runPath: input.runPath,
          storyId: input.storyId,
          reason: input.reason,
          requestedBy: 'mcp',
        }),
      ),
  );

  server.registerTool(
    'workflow_tracker_validate',
    {
      description: 'Validate tracker contract diagnostics before runtime execution.',
      inputSchema: workflowTrackerValidateInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_tracker_validate', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return trackerValidateFacade(toOverrides(input));
      }),
  );

  server.registerTool(
    'workflow_tracker_migrate',
    {
      description: 'Draft a kit tracker from an existing markdown backlog or tracker source plus diagnostics.',
      inputSchema: workflowTrackerMigrateInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_tracker_migrate', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return trackerMigrateFacade({ ...toOverrides(input), from: input.from, track: input.track });
      }),
  );

  server.registerTool(
    'list_tracks',
    {
      description:
        'Discover tracker directories and active tracks. Run first when you do not know available track ids.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('list_tracks', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return listTracksHandler(toOverrides(input));
      }),
  );

  server.registerTool(
    'list_stories',
    {
      description:
        'Parse tracker stories for one track or all active tracks. Use track to narrow large repos; use before run_story to find exact ids.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('list_stories', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return listStoriesHandler(toOverrides(input));
      }),
  );

  server.registerTool(
    'list_eligible',
    {
      description:
        'Stories ready to dispatch after status, owner, and dependency filtering. Run before run_eligible; if more than one track has eligible stories you must pass track.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('list_eligible', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return listEligibleHandler(toOverrides(input));
      }),
  );

  server.registerTool(
    'run_eligible',
    {
      description:
        'Dry-run or launch eligible stories for a single track. Defaults to dry-run unless dryRun is false. Non-dry-run returns after initial child launch with runId/artifactDir; use watch_run and analyze_run for supervision. Non-dry-run with sandbox danger-full-access and approvalPolicy never runs unsupervised child sessions with full disk access.',
      inputSchema: runInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const overrides = toOverrides({ ...input, dryRun: input.dryRun !== false, asyncLaunch: input.dryRun === false });
      return handleTool(
        'run_eligible',
        input.responseFormat,
        () => {
          assertWorkflowRepoContext(input);
          return runWorkflowHandler({ kind: 'run-eligible', overrides }, { logger: nullLogger, stdout: noopStdout });
        },
        summarizeRun,
      );
    },
  );

  server.registerTool(
    'run_story',
    {
      description:
        'Dry-run or launch one tracker story. Defaults to dry-run unless dryRun is false. Non-dry-run may run a long child session; use watch_run and analyze_run for supervision.',
      inputSchema: runStoryInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => {
      const overrides = toOverrides({ ...input, dryRun: input.dryRun !== false });
      return handleTool(
        'run_story',
        input.responseFormat,
        () => {
          assertWorkflowRepoContext(input);
          return runWorkflowHandler(
            { kind: 'run-story', storyId: input.storyId, overrides },
            { logger: nullLogger, stdout: noopStdout },
          );
        },
        summarizeRun,
      );
    },
  );

  server.registerTool(
    'watch_run',
    {
      description:
        'Read current state.json, metrics.live.json, and a meaningful run summary for a run artifact directory returned by run_story or run_eligible. Returns immediately by default; prefer watch_run_start and watch_run_poll for long supervision.',
      inputSchema: runPathInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('watch_run', input.responseFormat, () => watchRunHandler(input.runPath, toOverrides(input))),
  );

  server.registerTool(
    'watch_run_start',
    {
      description:
        'Start nonblocking run supervision. Returns the current watch summary plus a cursor for later watch_run_poll calls.',
      inputSchema: runPathInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('watch_run_start', input.responseFormat, () =>
        startWatchRunHandler(input.runPath, toOverrides(input)),
      ),
  );

  server.registerTool(
    'watch_run_poll',
    {
      description:
        'Poll a nonblocking run watch using a cursor from watch_run_start or a previous watch_run_poll call. Returns meaningful snapshot data and raw changes since the cursor.',
      inputSchema: watchRunPollInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('watch_run_poll', input.responseFormat, () =>
        pollWatchRunHandler({ runPath: input.runPath, cursor: input.cursor }, toOverrides(input)),
      ),
  );

  server.registerTool(
    'watch_run_stop',
    {
      description:
        'Stop a nonblocking watch id returned by watch_run_start. Cursor correctness is client-side, so this only releases process-local watch state when present.',
      inputSchema: watchRunStopInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) => handleTool('watch_run_stop', input.responseFormat, () => stopWatchRunHandler(input.watchId)),
  );

  server.registerTool(
    'workflow_child_reply',
    {
      description:
        'Send an operator reply to a live child session through the configured driver. Target either sessionId directly or runPath plus storyId; run-targeted replies are journaled with a redacted preview and hash.',
      inputSchema: codexReplyInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) =>
      handleTool('workflow_child_reply', input.responseFormat, () =>
        controlConfiguredChild(input, { kind: 'reply', message: input.message }),
      ),
  );

  server.registerTool(
    'workflow_child_interrupt',
    {
      description:
        'Interrupt a live child session through the configured driver. Target either sessionId directly or runPath plus storyId; run-targeted interrupts are journaled.',
      inputSchema: codexInterruptInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) =>
      handleTool('workflow_child_interrupt', input.responseFormat, () =>
        controlConfiguredChild(input, { kind: 'interrupt', reason: input.reason }),
      ),
  );

  server.registerTool(
    'workflow_driver_check',
    {
      description: 'Validate the configured child-session driver schema before launching non-dry-run children.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('workflow_driver_check', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return mcpCheckHandler(toOverrides(input), { logger: nullLogger });
      }),
  );

  server.registerTool(
    'codex_reply',
    {
      description:
        'Send an operator reply to a live Codex child session. Target either sessionId directly or runPath plus storyId; run-targeted replies are journaled with a redacted preview and hash.',
      inputSchema: codexReplyInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => handleTool('codex_reply', input.responseFormat, () => sendCodexReply(input)),
  );

  server.registerTool(
    'codex_interrupt',
    {
      description:
        'Interrupt a live Codex child session. Target either sessionId directly or runPath plus storyId; run-targeted interrupts are journaled.',
      inputSchema: codexInterruptInputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (input) => handleTool('codex_interrupt', input.responseFormat, () => sendCodexInterrupt(input)),
  );

  server.registerTool(
    'analyze_run',
    {
      description:
        'Analyze a completed run artifact directory and child session artifacts, including compatible interactive implement-next journals. Use after watch_run shows the run is complete or blocked.',
      inputSchema: runPathInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool(
        'analyze_run',
        input.responseFormat,
        async () => {
          const analysis = await analyzeRunHandler(input.runPath, toOverrides(input));
          return input.responseFormat === 'detailed' ? analysis : conciseAnalysisContent(analysis);
        },
        summarizeAnalysis,
      ),
  );

  server.registerTool(
    'check_codex_mcp',
    {
      description:
        'Validate the Codex child MCP server schema used by the codex-mcp driver before launching non-dry-run children.',
      inputSchema: baseInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (input) =>
      handleTool('check_codex_mcp', input.responseFormat, () => {
        assertWorkflowRepoContext(input);
        return mcpCheckHandler(toOverrides(input), { logger: nullLogger });
      }),
  );
}

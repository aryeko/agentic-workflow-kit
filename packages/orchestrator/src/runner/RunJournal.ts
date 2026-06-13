import path from 'node:path';
import type { StoryCommitEvidence } from '../git/GitInspector.js';
import { safeName } from '../internal/guards.js';
import { normalizeChildMetricsSnapshot, nullableMetric, UNAVAILABLE_REASONS } from '../metrics/availability.js';
import { buildBudgetArtifact } from '../metrics/budgets.js';
import { buildLiveMetricsSnapshot, enrichLiveMetricsFromSessionLogs } from '../metrics/liveMetrics.js';
import type {
  ArtifactStore,
  BudgetArtifact,
  ChildLaunchRecord,
  ChildMetricsSnapshot,
  ChildResultEvidence,
  Clock,
  LiveMetricsSnapshot,
  ResolvedWorkflowConfig,
  RunRowArtifact,
  RunState,
  RunSummaryArtifact,
  TranscriptIndexArtifact,
  WorkflowStory,
} from '../types.js';
import type { MetricsCollector } from './MetricsCollector.js';

export interface SettledStoryRun {
  storyId: string;
  ok: boolean;
  sessionId: string | null;
  content?: string;
  rawResult?: unknown;
  invocation?: Record<string, unknown>;
  error?: string;
  completedAt: string;
  metrics?: ChildMetricsSnapshot;
  evidence?: ChildResultEvidence;
  commitEvidence?: StoryCommitEvidence;
  baseShaAtLaunch?: string | null;
  completionAuthority?: string;
  completionAuthoritySource?: string;
}

export interface RunJournalDependencies {
  artifactStore: ArtifactStore;
  clock: Clock;
}

export class RunJournal {
  constructor(private readonly dependencies: RunJournalDependencies) {}

  async writeRunMetadata(state: RunState): Promise<void> {
    await this.dependencies.artifactStore.writeJson('run.json', {
      runId: state.runId,
      command: state.command,
      workspaceRoot: state.workspaceRoot,
      artifactDir: state.artifactDir,
      startedAt: state.startedAt,
    });
  }

  async writeConfigSnapshot(config: ResolvedWorkflowConfig): Promise<void> {
    await this.dependencies.artifactStore.writeJson('config.resolved.json', config);
  }

  async writeState(state: RunState): Promise<void> {
    await this.dependencies.artifactStore.writeJson('state.json', state);
  }

  async writeLiveMetrics(
    state: RunState,
    childMetrics: Record<string, ChildMetricsSnapshot>,
  ): Promise<LiveMetricsSnapshot> {
    const snapshot = await enrichLiveMetricsFromSessionLogs(
      buildLiveMetricsSnapshot({
        runId: state.runId,
        status: state.status,
        startedAt: state.startedAt,
        now: this.dependencies.clock.now(),
        maxParallel: state.maxParallel,
        active: state.active,
        completed: state.completed,
        blockedStoryId: state.blockedStoryId,
        blockedReason: state.blockedReason,
        childMetrics,
      }),
    );
    await this.dependencies.artifactStore.writeJson('metrics.live.json', snapshot);
    return snapshot;
  }

  async writeRuntimeArtifacts(
    state: RunState,
    config: ResolvedWorkflowConfig,
    metrics: LiveMetricsSnapshot,
  ): Promise<BudgetArtifact> {
    const rows = buildRows(state, metrics);
    const budgets = buildBudgetArtifact(state.runId, config, metrics);
    await this.dependencies.artifactStore.writeJson('summary.json', buildSummary(state, metrics));
    await this.dependencies.artifactStore.writeJson('rows.json', { schemaVersion: 1, rows });
    await this.dependencies.artifactStore.writeJson('budgets.json', budgets);
    await this.dependencies.artifactStore.writeJson('transcripts.json', buildTranscriptIndex(state, rows));
    return budgets;
  }

  async writeStorySnapshot(label: string, stories: WorkflowStory[]): Promise<void> {
    const fileName = `${safeName(label)}.json`;
    await this.dependencies.artifactStore.writeJson(path.join('stories', fileName), stories);
    if (label === 'initial') {
      await this.dependencies.artifactStore.writeJson('stories.initial.json', stories);
    }
  }

  async recordSettledChild(
    metrics: MetricsCollector,
    settled: SettledStoryRun,
    returnedStory?: Pick<WorkflowStory, 'status'> | null,
    returnedComplete?: boolean | null,
  ): Promise<RunState['completed'][number]> {
    const childMetric = metrics.childTiming(settled.storyId);
    const returnedStatus = returnedStory?.status ?? null;
    const normalizedReturnedComplete = returnedComplete ?? null;
    const augmentedSettled = {
      ...settled,
      startedAt: childMetric?.startedAt,
      durationMs: childMetric?.durationMs,
      returnedStatus,
      returnedComplete: normalizedReturnedComplete,
    };

    await this.dependencies.artifactStore.writeJson(`children/${safeName(settled.storyId)}.json`, augmentedSettled);
    if (settled.rawResult !== undefined) {
      await this.dependencies.artifactStore.writeJson(
        `children/${safeName(settled.storyId)}.raw.json`,
        settled.rawResult,
      );
    }
    return {
      storyId: settled.storyId,
      ok: settled.ok,
      sessionId: settled.sessionId,
      completedAt: settled.completedAt,
      startedAt: childMetric?.startedAt,
      durationMs: childMetric?.durationMs,
      returnedStatus,
      returnedComplete: normalizedReturnedComplete,
    };
  }

  async recordChildLaunch(record: ChildLaunchRecord): Promise<void> {
    await this.dependencies.artifactStore.writeJson(`children/${safeName(record.storyId)}.launch.json`, record);
  }

  async updateChildLaunch(record: ChildLaunchRecord, fields: Partial<ChildLaunchRecord>): Promise<ChildLaunchRecord> {
    const updated = { ...record, ...fields, updatedAt: this.dependencies.clock.now() };
    await this.recordChildLaunch(updated);
    return updated;
  }

  async record(type: string, fields: Record<string, unknown> = {}): Promise<void> {
    const recordedAt = this.dependencies.clock.now();
    const explicitEventAt = typeof fields.eventAt === 'string' ? fields.eventAt : null;
    await this.dependencies.artifactStore.appendEvent({
      ...fields,
      recordedAt,
      eventAt: explicitEventAt ?? recordedAt,
      type,
    });
  }
}

function buildSummary(state: RunState, metrics: LiveMetricsSnapshot): RunSummaryArtifact {
  const unavailable: Record<string, string> = {};
  for (const [storyId, child] of Object.entries(metrics.children)) {
    const normalized = normalizeChildMetricsSnapshot(child);
    for (const [dimension, availability] of Object.entries(normalized.availability ?? {})) {
      if (availability.status === 'unavailable' && availability.unavailableReason) {
        unavailable[`children.${storyId}.${dimension}`] = availability.unavailableReason;
      }
    }
  }
  if (metrics.aggregate.tokenTotals === null) unavailable['aggregate.tokenTotals'] = UNAVAILABLE_REASONS.tokenTelemetry;
  return {
    schemaVersion: 1,
    runId: state.runId,
    command: state.command,
    status: state.status,
    derivedStatus: state.status,
    startedAt: state.startedAt,
    completedAt: state.completedAt ?? null,
    elapsedMs: metrics.elapsedMs,
    blockedStoryId: state.blockedStoryId,
    blockedReason: state.blockedReason,
    activeStoryIds: state.active,
    completedStoryIds: state.completed.map((entry) => entry.storyId),
    artifactPaths: {
      run: 'run.json',
      config: 'config.resolved.json',
      state: 'state.json',
      metrics: 'metrics.live.json',
      events: 'events.ndjson',
      summary: 'summary.json',
      rows: 'rows.json',
      budgets: 'budgets.json',
      transcripts: 'transcripts.json',
    },
    aggregate: metrics.aggregate,
    unavailable,
  };
}

function buildRows(state: RunState, metrics: LiveMetricsSnapshot): RunRowArtifact[] {
  const storyIds = new Set([
    ...state.active,
    ...state.completed.map((entry) => entry.storyId),
    ...(state.interactive ? [state.interactive.storyId] : []),
    ...Object.keys(metrics.children),
  ]);
  return [...storyIds].sort().map((storyId) => {
    const completed = state.completed.find((entry) => entry.storyId === storyId);
    const active = state.active.includes(storyId);
    const child = metrics.children[storyId]
      ? normalizeChildMetricsSnapshot(metrics.children[storyId])
      : normalizeChildMetricsSnapshot({
          storyId,
          toolCounts: {},
          subagentCounts: {},
          tokenTotals: null,
          latestProgress: null,
          sessionLogPath: state.interactive?.storyId === storyId ? state.interactive.sessionLogPath : null,
        });
    const availability = child.availability;
    return {
      runId: state.runId,
      storyId,
      status: completed
        ? 'completed'
        : active
          ? 'active'
          : state.interactive?.storyId === storyId
            ? 'interactive'
            : 'unknown',
      ok: completed?.ok ?? (state.interactive?.storyId === storyId ? state.interactive.ok : null),
      sessionId: completed?.sessionId ?? (state.interactive?.storyId === storyId ? state.interactive.sessionId : null),
      sessionLogPath: child.sessionLogPath,
      startedAt: completed?.startedAt ?? null,
      completedAt: completed?.completedAt ?? null,
      durationMs: completed?.durationMs ?? null,
      latestProgress: child.latestProgress,
      toolCalls: nullableMetric(
        sumCounts(child.toolCounts),
        availability?.toolCounts,
        UNAVAILABLE_REASONS.sessionLogMetrics,
      ),
      failedToolCalls: nullableMetric(null, undefined, UNAVAILABLE_REASONS.sessionLogMetrics),
      subagents: nullableMetric(
        sumCounts(child.subagentCounts),
        availability?.subagentCounts,
        UNAVAILABLE_REASONS.sessionLogMetrics,
      ),
      tokens: nullableMetric(child.tokenTotals, availability?.tokenTotals, UNAVAILABLE_REASONS.tokenTelemetry),
    };
  });
}

function buildTranscriptIndex(state: RunState, rows: RunRowArtifact[]): TranscriptIndexArtifact {
  return {
    schemaVersion: 1,
    runId: state.runId,
    transcripts: rows.map((row) => ({
      storyId: row.storyId,
      sessionId: row.sessionId,
      sessionLogPath: row.sessionLogPath,
      status: row.sessionLogPath ? 'linked' : row.sessionId ? 'missing' : 'unlinked',
      unavailableReason: row.sessionLogPath
        ? null
        : row.sessionId
          ? 'session log path is missing'
          : UNAVAILABLE_REASONS.sessionLog,
    })),
  };
}

function sumCounts(counts: Record<string, number>): number | null {
  const values = Object.values(counts);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

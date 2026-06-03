import path from 'node:path';
import type { StoryCommitEvidence } from '../git/GitInspector.js';
import { safeName } from '../internal/guards.js';
import { buildLiveMetricsSnapshot } from '../metrics/liveMetrics.js';
import type {
  ArtifactStore,
  ChildMetricsSnapshot,
  Clock,
  ResolvedWorkflowConfig,
  RunState,
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
  commitEvidence?: StoryCommitEvidence;
  baseShaAtLaunch?: string | null;
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

  async writeLiveMetrics(state: RunState, childMetrics: Record<string, ChildMetricsSnapshot>): Promise<void> {
    await this.dependencies.artifactStore.writeJson(
      'metrics.live.json',
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

  async record(type: string, fields: Record<string, unknown> = {}): Promise<void> {
    await this.dependencies.artifactStore.appendEvent({
      ts: this.dependencies.clock.now(),
      type,
      ...fields,
    });
  }
}

import type { ChildMetricsSnapshot, ChildResultEvidence, WorkflowStory } from '../types.js';

export type ChildLifecycleEvent =
  | { type: 'session-linked'; sessionId: string; sessionLogPath?: string | null }
  | { type: 'progress'; message: string; progressToken?: string | number | null };

export interface StoryRunRequest {
  story: WorkflowStory;
  prompt: string;
  cwd: string;
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
  onLifecycle?: (event: ChildLifecycleEvent) => Promise<void> | void;
}

export interface StoryRunResult {
  storyId: string;
  sessionId: string | null;
  content: string;
  rawResult: unknown;
  invocation: Record<string, unknown>;
  evidence?: ChildResultEvidence;
  metrics?: ChildMetricsSnapshot;
}

export interface DriverToolStatus {
  ok: boolean;
  tools: string[];
}

export interface StoryRunner {
  runStory(request: StoryRunRequest): Promise<StoryRunResult>;
  checkTools(): Promise<DriverToolStatus>;
}

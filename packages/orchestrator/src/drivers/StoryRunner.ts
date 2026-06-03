import type { ChildMetricsSnapshot, WorkflowStory } from '../types.js';

export interface StoryRunRequest {
  story: WorkflowStory;
  prompt: string;
  cwd: string;
  metadata: Record<string, unknown>;
}

export interface StoryRunResult {
  storyId: string;
  sessionId: string | null;
  content: string;
  rawResult: unknown;
  invocation: Record<string, unknown>;
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

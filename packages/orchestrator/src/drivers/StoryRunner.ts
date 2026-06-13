import type {
  CapabilityDowngrade,
  ChildMetricsSnapshot,
  ChildProgressSource,
  ChildResultEvidence,
  ResolvedAgentProfile,
  WorkflowStory,
} from '../types.js';

export type { ChildProgressSource } from '../types.js';

export type ChildLifecycleEvent =
  | {
      type: 'session-linked';
      sessionId: string;
      sessionLogPath?: string | null;
      progressSource: ChildProgressSource;
    }
  | {
      type: 'progress';
      message: string;
      progressSource: ChildProgressSource;
      progressToken?: string | number | null;
      eventType?: string | null;
      journal?: boolean;
    };

export interface StoryRunRequest {
  story: WorkflowStory;
  prompt: string;
  profile: ResolvedAgentProfile;
  promptMetadata: StoryPromptMetadata;
  cwd: string;
  metadata: Record<string, unknown>;
  signal?: AbortSignal;
  onLifecycle?: (event: ChildLifecycleEvent) => Promise<void> | void;
}

export interface StoryPromptMetadata {
  template: string;
  promptHash: string;
  structuredOutputSchema: string;
  structuredOutputRequired: boolean;
}

export interface StoryRunResult {
  storyId: string;
  sessionId: string | null;
  content: string;
  rawResult: unknown;
  invocation: Record<string, unknown>;
  evidence?: ChildResultEvidence;
  capabilityDowngrades?: CapabilityDowngrade[];
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

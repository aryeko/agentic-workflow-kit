import type { RunEventCursor } from '../../core/run-lifecycle/contracts/index.js';

type WorkSourceSelector = {
  workSourceId: string;
};

type StartRunSelection =
  | {
      mode: 'task';
      taskId: string;
      trackId?: string;
    }
  | {
      mode: 'next-eligible';
      trackId?: string;
    };

type InspectRunViewSelector = 'state' | 'events' | 'approvals' | 'gates' | 'analysis';

type RunInspectionStateView = {
  lifecycle: string;
  currentSequence: number;
};

type RunInspectionEventsView = {
  eventIds: string[];
};

type RunInspectionApprovalsView = {
  requestIds: string[];
};

type RunInspectionGatesView = {
  recordIds: string[];
};

type RunInspectionAnalysisView = {
  recordIds: string[];
  reportRefs?: string[];
};

export type PreviewRunParams = {
  workSource: WorkSourceSelector;
  trackIds?: string[];
  taskIds?: string[];
  profileName: string;
  dryRun: true;
};

export type PreviewRunView = {
  workSource: WorkSourceSelector;
  profileName: string;
  dryRun: true;
  selectedTrackIds?: string[];
  selectedTaskIds?: string[];
  candidateCount: number;
};

export type StartRunParams = {
  workSource: WorkSourceSelector;
  selection: StartRunSelection;
  profileName: string;
  concurrencyKey?: string;
  idempotencyKey?: string;
};

export type RunStartedView = {
  workSource: WorkSourceSelector;
  profileName: string;
  selection: StartRunSelection;
  queued: boolean;
};

export type InspectRunParams = {
  runId: string;
  viewSelectors: InspectRunViewSelector[];
  cursor?: RunEventCursor;
  limit?: number;
};

export type RunInspectionView = {
  runId: string;
  includedViews: InspectRunViewSelector[];
  cursor?: RunEventCursor;
  nextCursor?: RunEventCursor;
  state?: RunInspectionStateView;
  events?: RunInspectionEventsView;
  approvals?: RunInspectionApprovalsView;
  gates?: RunInspectionGatesView;
  analysis?: RunInspectionAnalysisView;
};

import {
  isWorkSourceError,
  type ClaimResult,
  type StatusWriteResult,
  type WorkSourceError,
  type WorkSourceProvider,
} from 'sdk';

import { conformanceResult, failCheck, passCheck, type ConformanceResult } from '../conformance/index.js';
import { workSourceIncidentFixtures } from '../fixtures/work-source/index.js';
import { createMockWorkSourceProvider } from './mock-work-source-provider.js';

export type WorkSourceConformanceToken = Extract<
  WorkSourceError['kind'],
  | 'claim-conflict'
  | 'status-authority-conflict'
  | 'dependency-unresolved'
  | 'status-bucket-unknown'
  | 'track-malformed'
  | 'work-source-unavailable'
>;

export type WorkSourceConformanceResult = ConformanceResult<WorkSourceConformanceToken>;

const isClaimResult = (value: unknown): value is ClaimResult =>
  typeof value === 'object' && value !== null && 'snapshotDigest' in value;

const isStatusWriteResult = (value: unknown): value is StatusWriteResult =>
  typeof value === 'object' && value !== null && 'written' in value;

export const workSourceConformance = (provider: WorkSourceProvider): WorkSourceConformanceResult => {
  const tasks = provider.listTasks('track-a');
  if (isWorkSourceError(tasks) || tasks.length === 0) {
    return conformanceResult([
      failCheck('listTasks', 'track-malformed', 'Unable to read track-a tasks for conformance.'),
    ]);
  }

  const [task] = tasks;
  const statusWrite = provider.writeStatus({
    task: task.key,
    status: { native: 'done', bucket: 'complete' },
    expectedRecordDigest: 'sha256:stale',
  });
  const firstClaim = provider.claim({
    task: task.key,
    runId: 'run-1',
    holder: 'runner',
    ttlMs: 60_000,
    expectedRecordDigest: task.sourceRecordDigest,
    sourceRevision: 'rev-1',
  });
  const secondClaim = provider.claim({
    task: task.key,
    runId: 'run-2',
    holder: 'other-runner',
    ttlMs: 60_000,
    expectedRecordDigest: task.sourceRecordDigest,
    sourceRevision: 'rev-2',
  });

  return conformanceResult([
    isWorkSourceError(statusWrite) && statusWrite.kind === 'status-authority-conflict'
      ? passCheck<WorkSourceConformanceToken>('status-authority-separation')
      : failCheck(
          'status-authority-separation',
          'status-authority-conflict',
          'Provider allowed a stale status authority write.',
        ),
    isClaimResult(firstClaim) &&
    isWorkSourceError(secondClaim) &&
    secondClaim.kind === 'claim-conflict' &&
    !isStatusWriteResult(secondClaim)
      ? passCheck('race-safe-claim')
      : failCheck('race-safe-claim', 'claim-conflict', 'Provider did not enforce single-winner claim semantics.'),
  ]);
};

export const brokenWorkSourceFixtures = {
  doubleClaimWinner: {
    ...createMockWorkSourceProvider(workSourceIncidentFixtures.claimStatusRace.options),
    claim: (input) => ({
      task: {
        key: input.task,
        title: 'Broken double claim',
        status: { native: 'todo', bucket: 'eligible' },
        target: { project: 'sdk' },
        spec: { refs: [] },
        dependencies: [],
        sourceRecordDigest: input.expectedRecordDigest,
      },
      snapshotRef: {
        id: `memory://broken/${input.task.taskId}`,
        digest: 'sha256:broken',
        size: 1,
        mediaType: 'application/json',
        retentionClass: 'evidence',
        classification: 'internal',
        redactionState: 'raw',
      },
      snapshotDigest: 'sha256:broken',
    }),
  } satisfies WorkSourceProvider,
  ignoresStatusAuthority: {
    ...createMockWorkSourceProvider(workSourceIncidentFixtures.claimStatusRace.options),
    writeStatus: () => ({
      written: true,
      updatedRecordDigest: 'sha256:broken-status',
      at: '2026-06-22T12:00:00.000Z',
    }),
  } satisfies WorkSourceProvider,
} as const;

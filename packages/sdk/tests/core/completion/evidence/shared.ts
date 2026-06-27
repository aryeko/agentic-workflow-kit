import type {
  AppendIntent,
  CommandResult,
  EvidenceEventRef,
  LocalGitEvidenceRecordedPayload,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventCursor,
  RunEventEnvelope,
  RunProjections,
  RunReplay,
  RunWriter,
} from '../../../../src/index.js';

type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const runId = 'run-completion-evidence-01';
export const cursor: RunEventCursor = { runId, afterSequence: 20 };
export const projections = {} as RunProjections;

export const createLocalGitPayload = (
  overrides: Partial<LocalGitEvidenceRecordedPayload> = {},
): LocalGitEvidenceRecordedPayload => ({
  evidenceId: 'local-git-01',
  leaseId: 'lease-01',
  repoId: 'repo-01',
  worktreePath: '/tmp/worktree' as LocalGitEvidenceRecordedPayload['worktreePath'],
  branchName: 'feature/story',
  inspectedAt: '2026-06-27T09:00:00.000Z',
  baseSha: 'base-01',
  mergeBaseSha: 'merge-01',
  headSha: 'head-01',
  localCommits: [],
  fromSha: 'from-01',
  toSha: 'to-01',
  changedPaths: ['packages/sdk/src/core/completion/evidence/evaluate-completion.ts'],
  clean: true,
  stagedPaths: [],
  unstagedPaths: [],
  untrackedPaths: [],
  ...overrides,
});

export const createVerifyCommand = (
  overrides: Partial<CommandResult & { kind?: 'verify' }> = {},
): CommandResult & {
  kind: 'verify';
} => ({
  operationId: 'verify-op-01',
  commandDigest: 'sha256:verify-command',
  cwd: '/tmp/worktree',
  exitCode: 0,
  outputDigest: 'sha256:output',
  redactionApplied: true,
  startedAt: '2026-06-27T09:01:00.000Z',
  finishedAt: '2026-06-27T09:02:00.000Z',
  kind: 'verify',
  ...overrides,
});

export const createEvent = <TPayload>(
  type: string,
  sequence: number,
  payload: TPayload,
): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId: `evt-${type}-${sequence}`,
  sequence,
  writerEpoch: 1,
  domain: type === 'LocalGitEvidenceRecorded' ? 'fnd-03' : 'core-05',
  type,
  durability: 'barrier',
  occurredAt: `2026-06-27T09:0${sequence}:00.000Z`,
  recordedAt: `2026-06-27T09:0${sequence}:01.000Z`,
  payloadDigest: `sha256:${type}-${sequence}`,
  payload,
});

export const toRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

export const createReplay = (...events: RunEventEnvelope[]): RunReplay => ({
  runId,
  events,
  lastSequence: events.at(-1)?.sequence ?? 0,
  writerEpoch: 1,
  health: 'ok',
  healthRecords: [],
});

export const appendReceipt: RunAppendReceipt = {
  runId,
  firstSequence: 21,
  lastSequence: 21,
  writerEpoch: 1,
  durability: 'barrier',
  eventIds: ['evt-append-01'],
  payloadDigests: ['sha256:append-01'],
  frameDigest: 'sha256:frame-01',
  health: 'ok',
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[]) => Result<RunAppendReceipt, RunAppendFailure>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      return appendImpl?.(batch) ?? { ok: true, value: appendReceipt };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };
  return writer;
};

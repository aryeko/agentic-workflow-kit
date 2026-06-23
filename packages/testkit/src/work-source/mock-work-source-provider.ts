import { workSourceCapabilities } from 'sdk';
import type {
  ArtifactRef,
  AuditCitation,
  CapabilityAttestation,
  Claim,
  ClaimResult,
  SpecRef,
  StatusBucket,
  StatusBuckets,
  StatusWriteResult,
  TaskKey,
  TaskStatus,
  TaskView,
  TrackView,
  WorkSourceCapability,
  WorkSourceError,
  WorkSourceProbeScope,
  WorkSourceProvider,
} from 'sdk';

export interface MockWorkSourceTaskFixture {
  readonly taskId: string;
  readonly title: string;
  readonly status: string | TaskStatus;
  readonly targetProject: string;
  readonly spec?: {
    readonly inline?: string;
    readonly refs?: readonly SpecRef[];
  };
  readonly dependencies?: readonly TaskKey[];
  readonly claim?: Claim;
}

export interface MockWorkSourceTrackFixture {
  readonly trackId: string;
  readonly workSourceId?: string;
  readonly statusBuckets: StatusBuckets;
  readonly tasks: readonly MockWorkSourceTaskFixture[];
  readonly malformedDiagnostic?: string;
}

export interface MockWorkSourceFailures {
  readonly negativeCapabilities?: readonly WorkSourceCapability[];
  readonly snapshotArtifactUnavailableTaskIds?: readonly string[];
  readonly statusWriteUnavailableTaskIds?: readonly string[];
}

export interface MockWorkSourceOptions {
  readonly workSourceId?: string;
  readonly driverVersion?: string;
  readonly now?: string | (() => string);
  readonly unavailable?: Extract<WorkSourceError, { readonly kind: 'work-source-unavailable' }>;
  readonly failures?: MockWorkSourceFailures;
  readonly tracks: readonly MockWorkSourceTrackFixture[];
}

export type CreateMockWorkSourceProviderOptions = MockWorkSourceOptions;

interface InternalTask {
  readonly key: TaskKey;
  readonly title: string;
  readonly nativeStatus: string;
  readonly targetProject: string;
  readonly spec: {
    readonly inline?: string;
    readonly refs: readonly SpecRef[];
  };
  readonly dependencies: readonly TaskKey[];
  readonly claim?: Claim;
  readonly auditCitation?: AuditCitation;
  readonly note?: string;
}

interface InternalTrack {
  readonly workSourceId: string;
  readonly trackId: string;
  readonly statusBuckets: StatusBuckets;
  readonly tasks: readonly InternalTask[];
  readonly malformedDiagnostic?: string;
}

interface MockWorkSourceState {
  readonly tracks: readonly InternalTrack[];
}

const oneHourMs = 60 * 60 * 1000;
const statusBucketOrder = ['eligible', 'inProgress', 'complete', 'blocked'] as const satisfies readonly Exclude<
  StatusBucket,
  'unknown'
>[];

const defaultWorkSourceId = 'mock-work-source';
const defaultDriverVersion = '0.0.0-testkit';

const clone = <T>(value: T): T => structuredClone(value) as T;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
};

const digest = (value: unknown): string => {
  let hash = 0x811c9dc5;
  for (const char of stableStringify(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `sha256:mock-${hash.toString(16).padStart(8, '0')}`;
};

const keyToId = (key: TaskKey): string => `${key.workSourceId}/${key.trackId}/${key.taskId}`;

const isSameTaskKey = (left: TaskKey, right: TaskKey): boolean =>
  left.workSourceId === right.workSourceId && left.trackId === right.trackId && left.taskId === right.taskId;

const resolveStatus = (statusBuckets: StatusBuckets, nativeStatus: string): TaskStatus => {
  const bucket = statusBucketOrder.find((candidate) => statusBuckets[candidate].includes(nativeStatus));
  return {
    native: nativeStatus,
    bucket: bucket ?? 'unknown',
  };
};

const isActiveClaim = (claim: Claim | undefined, now: string): claim is Claim =>
  claim !== undefined && Date.parse(claim.expiresAt) > Date.parse(now);

const taskRecordDigest = (task: InternalTask): string =>
  digest({
    auditCitation: task.auditCitation,
    claim: task.claim,
    dependencies: task.dependencies,
    key: task.key,
    note: task.note,
    spec: task.spec,
    status: task.nativeStatus,
    targetProject: task.targetProject,
    title: task.title,
  });

const trackRecordDigest = (track: InternalTrack): string =>
  digest({
    statusBuckets: track.statusBuckets,
    taskDigests: track.tasks.map((task) => taskRecordDigest(task)),
    taskKeys: track.tasks.map((task) => task.key),
    trackId: track.trackId,
    workSourceId: track.workSourceId,
  });

const toTaskView = (track: InternalTrack, task: InternalTask): TaskView => ({
  key: clone(task.key),
  title: task.title,
  status: resolveStatus(track.statusBuckets, task.nativeStatus),
  target: { project: task.targetProject },
  spec: {
    ...(task.spec.inline === undefined ? {} : { inline: task.spec.inline }),
    refs: clone([...task.spec.refs]),
  },
  dependencies: clone([...task.dependencies]),
  ...(task.claim === undefined ? {} : { claim: clone(task.claim) }),
  sourceRecordDigest: taskRecordDigest(task),
});

const toTrackView = (track: InternalTrack): TrackView => ({
  trackId: track.trackId,
  workSourceId: track.workSourceId,
  statusBuckets: clone(track.statusBuckets),
  taskKeys: clone(track.tasks.map((task) => task.key)),
  sourceRecordDigest: trackRecordDigest(track),
});

const toArtifactRef = (id: string, body: unknown): ArtifactRef => ({
  id,
  digest: digest(body),
  size: stableStringify(body).length,
  mediaType: 'application/json',
  retentionClass: 'evidence',
  classification: 'internal',
  redactionState: 'raw',
});

const createClaimConflict = (
  task: TaskKey,
  expectedRecordDigest: string,
  observedRecordDigest: string,
  expectedEpoch?: number,
  observedEpoch?: number,
): WorkSourceError => ({
  kind: 'claim-conflict',
  task: clone(task),
  expectedRecordDigest,
  observedRecordDigest,
  ...(expectedEpoch === undefined ? {} : { expectedEpoch }),
  ...(observedEpoch === undefined ? {} : { observedEpoch }),
});

const normalizeTask = (workSourceId: string, trackId: string, task: MockWorkSourceTaskFixture): InternalTask => ({
  key: {
    workSourceId,
    trackId,
    taskId: task.taskId,
  },
  title: task.title,
  nativeStatus: typeof task.status === 'string' ? task.status : task.status.native,
  targetProject: task.targetProject,
  spec: {
    ...(task.spec?.inline === undefined ? {} : { inline: task.spec.inline }),
    refs: clone([...(task.spec?.refs ?? [])]),
  },
  dependencies: clone([...(task.dependencies ?? [])]),
  ...(task.claim === undefined ? {} : { claim: clone(task.claim) }),
});

const normalizeTracks = (options: MockWorkSourceOptions): MockWorkSourceState => ({
  tracks: options.tracks.map((track) => {
    const workSourceId = track.workSourceId ?? options.workSourceId ?? defaultWorkSourceId;
    return {
      workSourceId,
      trackId: track.trackId,
      statusBuckets: clone(track.statusBuckets),
      tasks: track.tasks.map((task) => normalizeTask(workSourceId, track.trackId, task)),
      ...(track.malformedDiagnostic === undefined ? {} : { malformedDiagnostic: track.malformedDiagnostic }),
    };
  }),
});

const replaceTask = (
  state: MockWorkSourceState,
  taskKey: TaskKey,
  replace: (track: InternalTrack, task: InternalTask) => InternalTask,
): MockWorkSourceState => ({
  tracks: state.tracks.map((track) =>
    track.workSourceId === taskKey.workSourceId && track.trackId === taskKey.trackId
      ? {
          ...track,
          tasks: track.tasks.map((task) => (isSameTaskKey(task.key, taskKey) ? replace(track, task) : task)),
        }
      : track,
  ),
});

export const createMockWorkSourceProvider = (options: MockWorkSourceOptions): WorkSourceProvider => {
  let state = normalizeTracks(options);
  const driverVersion = options.driverVersion ?? defaultDriverVersion;
  const now = (): string =>
    typeof options.now === 'function' ? options.now() : (options.now ?? new Date(0).toISOString());
  const negativeCapabilities = new Set(options.failures?.negativeCapabilities ?? []);
  const snapshotArtifactUnavailableTaskIds = new Set(options.failures?.snapshotArtifactUnavailableTaskIds ?? []);
  const statusWriteUnavailableTaskIds = new Set(options.failures?.statusWriteUnavailableTaskIds ?? []);

  const unavailable = (): WorkSourceError | undefined =>
    options.unavailable === undefined ? undefined : clone(options.unavailable);

  const findTrack = (trackId: string): InternalTrack | undefined =>
    state.tracks.find((track) => track.trackId === trackId);

  const findTask = (
    task: TaskKey,
  ): { readonly track: InternalTrack; readonly task: InternalTask } | WorkSourceError => {
    const unavailableError = unavailable();
    if (unavailableError !== undefined) {
      return unavailableError;
    }

    const track = state.tracks.find(
      (candidate) => candidate.workSourceId === task.workSourceId && candidate.trackId === task.trackId,
    );
    if (track === undefined) {
      return {
        kind: 'track-malformed',
        trackId: task.trackId,
        diagnostic: `Track "${task.trackId}" is not present in the mock work source.`,
      };
    }
    if (track.malformedDiagnostic !== undefined) {
      return { kind: 'track-malformed', trackId: track.trackId, diagnostic: track.malformedDiagnostic };
    }

    const currentTask = track.tasks.find((candidate) => isSameTaskKey(candidate.key, task));
    if (currentTask === undefined) {
      return {
        kind: 'dependency-unresolved',
        task: clone(task),
        dependency: clone(task),
        reason: 'missing',
      };
    }

    return { track, task: currentTask };
  };

  const firstMalformedTrack = (): WorkSourceError | undefined => {
    const malformedTrack = state.tracks.find((track) => track.malformedDiagnostic !== undefined);
    return malformedTrack === undefined
      ? undefined
      : {
          kind: 'track-malformed',
          trackId: malformedTrack.trackId,
          diagnostic: malformedTrack.malformedDiagnostic ?? 'malformed',
        };
  };

  const claimLockUnavailable = (task: InternalTask): WorkSourceError => ({
    kind: 'claim-lock-unavailable',
    task: clone(task.key),
    leaseKey: `work-source:${task.key.workSourceId}:${task.key.trackId}`,
    ...(task.claim === undefined ? {} : { priorClaim: clone(task.claim) }),
  });

  const assertClaimEligible = (
    track: InternalTrack,
    task: InternalTask,
    currentNow: string,
  ): WorkSourceError | undefined => {
    const view = toTaskView(track, task);
    if (view.status.bucket === 'unknown') {
      return { kind: 'status-bucket-unknown', task: view.key, nativeStatus: view.status.native };
    }
    if (view.status.bucket !== 'eligible' || isActiveClaim(view.claim, currentNow)) {
      return claimLockUnavailable(task);
    }

    for (const dependency of view.dependencies) {
      const dependencyRecord = findTask(dependency);
      if ('kind' in dependencyRecord) {
        return {
          kind: 'dependency-unresolved',
          task: view.key,
          dependency,
          reason: dependencyRecord.kind === 'track-malformed' ? 'malformed' : 'missing',
        };
      }

      const dependencyStatus = toTaskView(dependencyRecord.track, dependencyRecord.task).status;
      if (dependencyStatus.bucket === 'unknown') {
        return { kind: 'dependency-unresolved', task: view.key, dependency, reason: 'unknown' };
      }
      if (dependencyStatus.bucket === 'blocked') {
        return { kind: 'dependency-unresolved', task: view.key, dependency, reason: 'blocked' };
      }
      if (dependencyStatus.bucket !== 'complete') {
        return { kind: 'dependency-unresolved', task: view.key, dependency, reason: 'incomplete' };
      }
    }

    return undefined;
  };

  const capabilityResult = (
    scope: WorkSourceProbeScope,
    capability: WorkSourceCapability,
  ): CapabilityAttestation<WorkSourceCapability> => {
    const sourceUnavailable = unavailable();
    const malformedTrack = firstMalformedTrack();
    const forcedNegative = negativeCapabilities.has(capability);
    const degradedSource = sourceUnavailable !== undefined || malformedTrack !== undefined;
    const result = forcedNegative || degradedSource ? 'negative' : 'positive';
    const at = scope.at || now();

    return {
      capability,
      probeMethod: 'testkit-in-memory-probe',
      result,
      evidenceRef: `memory://work-source/${options.workSourceId ?? defaultWorkSourceId}/probe/${capability}`,
      scope: `workSource:${options.workSourceId ?? defaultWorkSourceId}`,
      expiry: new Date(Date.parse(at) + oneHourMs).toISOString(),
      driverVersion: scope.driverVersion || driverVersion,
      platform: scope.platform,
      freshnessKey: scope.freshnessKey,
      at,
      details: {
        driverId: scope.driverId,
        sourceKind: scope.sourceKind,
        trackIds: scope.trackIds ?? [],
        ...(sourceUnavailable === undefined ? {} : { unavailable: sourceUnavailable.kind }),
        ...(malformedTrack === undefined ? {} : { malformedTrack: malformedTrack.kind }),
      },
    };
  };

  const provider: WorkSourceProvider = {
    probeCapabilities: (scope) => {
      const capabilities = scope.capabilities.length > 0 ? scope.capabilities : [...workSourceCapabilities];
      return capabilities.map((capability) => capabilityResult(scope, capability));
    },

    listTracks: () => {
      const unavailableError = unavailable();
      if (unavailableError !== undefined) {
        return unavailableError;
      }

      const malformedTrack = firstMalformedTrack();
      if (malformedTrack !== undefined) {
        return malformedTrack;
      }

      return state.tracks.map((track) => toTrackView(track));
    },

    listTasks: (trackId) => {
      const unavailableError = unavailable();
      if (unavailableError !== undefined) {
        return unavailableError;
      }

      const track = findTrack(trackId);
      if (track === undefined) {
        return {
          kind: 'track-malformed',
          trackId,
          diagnostic: `Track "${trackId}" is not present in the mock work source.`,
        };
      }
      if (track.malformedDiagnostic !== undefined) {
        return { kind: 'track-malformed', trackId, diagnostic: track.malformedDiagnostic };
      }

      return track.tasks.map((task) => toTaskView(track, task));
    },

    nextEligible: (input) => {
      const unavailableError = unavailable();
      if (unavailableError !== undefined) {
        return unavailableError;
      }

      const allowedTrackIds = new Set(input.trackIds ?? state.tracks.map((track) => track.trackId));
      const currentNow = now();

      for (const track of state.tracks.filter((candidate) => allowedTrackIds.has(candidate.trackId))) {
        if (track.malformedDiagnostic !== undefined) {
          return { kind: 'track-malformed', trackId: track.trackId, diagnostic: track.malformedDiagnostic };
        }

        for (const task of track.tasks) {
          const view = toTaskView(track, task);
          if (input.targetProject !== undefined && view.target.project !== input.targetProject) {
            continue;
          }
          const eligibilityError = assertClaimEligible(track, task, currentNow);
          if (eligibilityError !== undefined) {
            if (eligibilityError.kind !== 'claim-lock-unavailable') {
              return eligibilityError;
            }
            continue;
          }

          return view;
        }
      }

      return null;
    },

    claim: (input) => {
      const record = findTask(input.task);
      if ('kind' in record) {
        return record;
      }

      const observedDigest = taskRecordDigest(record.task);
      if (input.expectedRecordDigest !== observedDigest) {
        return createClaimConflict(
          input.task,
          input.expectedRecordDigest,
          observedDigest,
          undefined,
          record.task.claim?.epoch,
        );
      }
      const priorClaim = record.task.claim;
      const priorEpoch = priorClaim === undefined ? 0 : priorClaim.epoch;
      const eligibilityError = assertClaimEligible(record.track, record.task, now());
      if (eligibilityError !== undefined) {
        return eligibilityError;
      }
      if (snapshotArtifactUnavailableTaskIds.has(input.task.taskId)) {
        return {
          kind: 'snapshot-artifact-unavailable',
          task: clone(input.task),
          diagnostic: `Mock snapshot artifact unavailable for ${keyToId(input.task)}.`,
        };
      }

      const claimedAt = now();
      const claim: Claim = {
        runId: input.runId,
        holder: input.holder,
        claimedAt,
        expiresAt: new Date(Date.parse(claimedAt) + input.ttlMs).toISOString(),
        epoch: priorEpoch + 1,
      };

      state = replaceTask(state, input.task, (_track, task) => ({ ...task, claim }));
      const claimedRecord = findTask(input.task);
      if ('kind' in claimedRecord) {
        return claimedRecord;
      }

      const taskView = toTaskView(claimedRecord.track, claimedRecord.task);
      const snapshotBody = {
        task: taskView,
        sourcePath: `memory://work-source/${input.task.workSourceId}/${input.task.trackId}`,
        sourceRevision: input.sourceRevision,
        sourceBytesDigest: trackRecordDigest(claimedRecord.track),
        inlineSpecDigest: taskView.spec.inline === undefined ? undefined : digest(taskView.spec.inline),
        rawExcerptDigest: digest(taskView),
        createdAt: claimedAt,
      };
      const snapshotRef = toArtifactRef(
        `memory://work-source/${input.task.workSourceId}/snapshots/${input.task.trackId}/${input.task.taskId}/${claim.epoch}`,
        snapshotBody,
      );

      return {
        task: taskView,
        snapshotRef,
        snapshotDigest: snapshotRef.digest,
      } satisfies ClaimResult;
    },

    release: (input) => {
      const record = findTask(input.task);
      if ('kind' in record) {
        return record;
      }

      if (record.task.claim?.runId !== input.runId || record.task.claim.epoch !== input.expectedEpoch) {
        return createClaimConflict(
          input.task,
          taskRecordDigest(record.task),
          taskRecordDigest(record.task),
          input.expectedEpoch,
          record.task.claim?.epoch,
        );
      }

      state = replaceTask(state, input.task, (_track, task) => {
        const { claim: _claim, ...released } = task;
        return released;
      });

      return undefined;
    },

    writeStatus: (input) => {
      const record = findTask(input.task);
      if ('kind' in record) {
        return record;
      }

      const observedRecordDigest = taskRecordDigest(record.task);
      if (input.expectedRecordDigest !== observedRecordDigest) {
        return {
          kind: 'status-authority-conflict',
          task: clone(input.task),
          expectedRecordDigest: input.expectedRecordDigest,
          observedRecordDigest,
        };
      }

      if (statusWriteUnavailableTaskIds.has(input.task.taskId)) {
        return {
          kind: 'status-write-unavailable',
          task: clone(input.task),
          diagnostic: `Mock status write unavailable for ${keyToId(input.task)}.`,
        };
      }

      const resolvedStatus = resolveStatus(record.track.statusBuckets, input.status.native);
      if (resolvedStatus.bucket === 'unknown' || resolvedStatus.bucket !== input.status.bucket) {
        return { kind: 'status-bucket-unknown', task: clone(input.task), nativeStatus: input.status.native };
      }

      state = replaceTask(state, input.task, (_track, task) => ({
        ...task,
        nativeStatus: input.status.native,
        ...(input.auditCitation === undefined ? {} : { auditCitation: clone(input.auditCitation) }),
        ...(input.note === undefined ? {} : { note: input.note }),
      }));
      const updatedRecord = findTask(input.task);
      if ('kind' in updatedRecord) {
        return updatedRecord;
      }

      return {
        written: true,
        updatedRecordDigest: taskRecordDigest(updatedRecord.task),
        ...(input.evidenceRef === undefined ? {} : { evidenceRef: clone(input.evidenceRef) }),
        ...(input.auditCitation === undefined ? {} : { auditCitation: clone(input.auditCitation) }),
        at: now(),
      } satisfies StatusWriteResult;
    },
  };

  return provider;
};

import type { RunLifecycleState } from '../contracts/index.js';

export const TERMINAL_LIFECYCLE_STATE_SET = [
  'completed',
  'blocked',
  'failed',
  'canceled',
] as const satisfies readonly RunLifecycleState[];

export function isTerminalLifecycleState(state: RunLifecycleState): boolean {
  return (TERMINAL_LIFECYCLE_STATE_SET as readonly RunLifecycleState[]).includes(state);
}

export const NON_TERMINAL_LIFECYCLE_STATE_SET = [
  'created',
  'configured',
  'task-snapshotted',
  'workspace-ready',
  'worker-starting',
  'running',
  'parked',
  'runner-verifying',
  'forge-waiting',
  'merge-waiting',
  'settling',
] as const satisfies readonly RunLifecycleState[];

type RequiredReferenceEventType =
  | 'RunCreated'
  | 'RunPolicyBound'
  | 'TaskSnapshotRecorded'
  | 'SessionLinked'
  | 'Evidence';

export const RECOVERY_RETRY_EVIDENCE_EVENT_TYPES = [
  'RecoveryClassified',
  'RecoveryActionPlanned',
  'RecoveryActionApplied',
  'ReconciliationBlocked',
] as const;

export type LifecycleTransitionConstraint =
  | {
      kind: 'required-reference';
      requiredEventType: Exclude<RequiredReferenceEventType, 'RecoveryRetry'>;
      requiresBarrier: boolean;
    }
  | {
      kind: 'recovery-retry';
      requiredEventTypes: typeof RECOVERY_RETRY_EVIDENCE_EVENT_TYPES;
      requiresBarrier: false;
    }
  | {
      kind: 'terminal-transition';
      requiredEventType: 'Evidence';
      requiresBarrier: true;
      requiredAuthority?: 'operator';
    };

export type LifecycleLegalEdge = {
  from: RunLifecycleState | null;
  to: RunLifecycleState;
  constraint: LifecycleTransitionConstraint;
};

const baseForwardEdges: LifecycleLegalEdge[] = [
  {
    from: null,
    to: 'created',
    constraint: { kind: 'required-reference', requiredEventType: 'RunCreated', requiresBarrier: true },
  },
  {
    from: 'created',
    to: 'configured',
    constraint: {
      kind: 'required-reference',
      requiredEventType: 'RunPolicyBound',
      requiresBarrier: true,
    },
  },
  {
    from: 'configured',
    to: 'task-snapshotted',
    constraint: {
      kind: 'required-reference',
      requiredEventType: 'TaskSnapshotRecorded',
      requiresBarrier: true,
    },
  },
  {
    from: 'task-snapshotted',
    to: 'workspace-ready',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'workspace-ready',
    to: 'worker-starting',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'worker-starting',
    to: 'running',
    constraint: { kind: 'required-reference', requiredEventType: 'SessionLinked', requiresBarrier: false },
  },
  {
    from: 'running',
    to: 'parked',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'running',
    to: 'runner-verifying',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'parked',
    to: 'running',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'runner-verifying',
    to: 'forge-waiting',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'forge-waiting',
    to: 'merge-waiting',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'merge-waiting',
    to: 'settling',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: false },
  },
  {
    from: 'settling',
    to: 'completed',
    constraint: { kind: 'required-reference', requiredEventType: 'Evidence', requiresBarrier: true },
  },
];

const recoveryEdges: LifecycleLegalEdge[] = [
  {
    from: 'runner-verifying',
    to: 'running',
    constraint: {
      kind: 'recovery-retry',
      requiredEventTypes: RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
      requiresBarrier: false,
    },
  },
  {
    from: 'forge-waiting',
    to: 'runner-verifying',
    constraint: {
      kind: 'recovery-retry',
      requiredEventTypes: RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
      requiresBarrier: false,
    },
  },
  {
    from: 'merge-waiting',
    to: 'forge-waiting',
    constraint: {
      kind: 'recovery-retry',
      requiredEventTypes: RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
      requiresBarrier: false,
    },
  },
  {
    from: 'settling',
    to: 'merge-waiting',
    constraint: {
      kind: 'recovery-retry',
      requiredEventTypes: RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
      requiresBarrier: false,
    },
  },
];

const expandedTerminalEdges: LifecycleLegalEdge[] = NON_TERMINAL_LIFECYCLE_STATE_SET.flatMap((from) => [
  {
    from,
    to: 'blocked',
    constraint: { kind: 'terminal-transition', requiredEventType: 'Evidence', requiresBarrier: true },
  },
  {
    from,
    to: 'failed',
    constraint: { kind: 'terminal-transition', requiredEventType: 'Evidence', requiresBarrier: true },
  },
  {
    from,
    to: 'canceled',
    constraint: {
      kind: 'terminal-transition',
      requiredEventType: 'Evidence',
      requiresBarrier: true,
      requiredAuthority: 'operator',
    },
  },
]);

export const LIFECYCLE_LEGAL_EDGE_CATALOG: readonly LifecycleLegalEdge[] = [
  ...baseForwardEdges,
  ...recoveryEdges,
  ...expandedTerminalEdges,
];

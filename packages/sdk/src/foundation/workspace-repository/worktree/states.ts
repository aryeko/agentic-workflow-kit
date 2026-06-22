export const WORKTREE_LEASE_STATES = [
  'planned',
  'leased',
  'branch-created',
  'setup-required',
  'ready',
  'finalized',
  'cleanup-pending',
  'cleanup-blocked',
  'cleaned',
] as const;

export type WorktreeLeaseState = (typeof WORKTREE_LEASE_STATES)[number];

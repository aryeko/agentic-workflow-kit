export type PresetName = 'push-and-merge' | 'gated-automerge' | 'push-only';

export interface RepoSignals {
  /** True when the base branch requires pull-request reviews before merge. */
  requiresReview: boolean;
  /** True when the repo has CI configured (e.g. .github/workflows present). */
  hasCI: boolean;
}

/**
 * Choose the default PR/merge preset from detected repo signals.
 *
 * - Required reviews => humans gate the merge => open a PR and stop (push-only).
 * - CI but no required reviews => wait on CI + bot review, then auto-merge (gated-automerge).
 * - Neither => open a PR and auto-merge after best-effort local checks (push-and-merge).
 */
export function selectPreset(signals: RepoSignals): PresetName {
  if (signals.requiresReview) return 'push-only';
  if (signals.hasCI) return 'gated-automerge';
  return 'push-and-merge';
}

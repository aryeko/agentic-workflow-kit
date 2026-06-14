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
 * New and unknown repositories default to push-only. Auto-merge presets remain available only as an
 * explicit opt-in choice.
 */
export function selectPreset(_signals: RepoSignals): PresetName {
  return 'push-only';
}

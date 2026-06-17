import type { PrePrReviewAwaitingMarker } from '../../types.js';
import type { StoryRunResult } from '../StoryRunner.js';
import { readAwaitingReviewMarker } from './evidenceParser.js';

/** Review mode for a child story run. */
export type ChildReviewMode = 'auto' | 'subagent' | 'inline' | 'orchestrator';

/**
 * Result of classifying how a child ended its turn.
 *
 * - `awaiting_review`: the child yielded at the pre-PR checkpoint (orchestrator mode only).
 * - `settled`: the child finished/settled its turn (opened a PR, merged, or simply completed).
 */
export type ChildTurnOutcome = { kind: 'awaiting_review'; marker: PrePrReviewAwaitingMarker } | { kind: 'settled' };

/**
 * Classifies how a child ended its turn.
 *
 * Returns `{ kind: 'awaiting_review', marker }` ONLY when `mode === 'orchestrator'` and the
 * result's evidence carries a valid awaiting-review marker (read from `result.evidence.prePrReview`).
 * All other cases - including non-orchestrator modes with a marker somehow present - return
 * `{ kind: 'settled' }`. Pure function, no IO.
 */
export function classifyChildTurnOutcome(result: StoryRunResult, mode: ChildReviewMode): ChildTurnOutcome {
  if (mode !== 'orchestrator') return { kind: 'settled' };
  const marker = readAwaitingReviewMarker(result.evidence?.prePrReview);
  if (marker) return { kind: 'awaiting_review', marker };
  return { kind: 'settled' };
}

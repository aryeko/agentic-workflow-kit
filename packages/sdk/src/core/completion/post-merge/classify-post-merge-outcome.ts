import type { PostMergeOutcomePayload } from '../contracts/index.js';

import {
  buildAmbiguousOutcome,
  buildOutcome,
  hasExactObservedHead,
  isAcceptedMergedEvent,
  isRefusedEvent,
  mapExactHeadRefusalToken,
} from './shared.js';
import type { RecordPostMergeOutcomeInput } from './types.js';

export const classifyPostMergeOutcome = (input: RecordPostMergeOutcomeInput): PostMergeOutcomePayload => {
  if (input.actionResult === undefined) {
    return buildAmbiguousOutcome(input);
  }

  if (input.actionResult.kind === 'accepted') {
    if (!hasExactObservedHead(input)) {
      return buildAmbiguousOutcome(input);
    }

    if (!isAcceptedMergedEvent(input)) {
      return buildAmbiguousOutcome(input);
    }

    return buildOutcome(input, 'post-merge-confirmed', 'completed');
  }

  if (!isRefusedEvent(input)) {
    return buildAmbiguousOutcome(input);
  }

  if (!hasExactObservedHead(input)) {
    return buildAmbiguousOutcome(input);
  }

  const tokenOutcome = mapExactHeadRefusalToken(input.actionResult.token);
  if (tokenOutcome === undefined) {
    return buildAmbiguousOutcome(input);
  }

  return buildOutcome(input, tokenOutcome.state, tokenOutcome.lifecycleTarget);
};

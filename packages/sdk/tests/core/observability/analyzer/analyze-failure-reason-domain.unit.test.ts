import { describe, expect, it } from 'vitest';
import { analyzeWithRuleSet } from '../../../../src/core/observability/analyzer/analyze.js';
import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import { createReplay, createRequest, createSnapshot, isAnalysisFailure } from './shared.js';

describe('core-07-s2 analyze failure reason domain', () => {
  it('returns only recordable analyzer failure reasons owned by this story', () => {
    const degraded = analyze(
      createRequest(),
      createSnapshot({
        replay: createReplay({
          health: 'event-log-unavailable',
        }),
      }),
    );
    const ruleError = analyzeWithRuleSet(createRequest(), createSnapshot(), [
      () => {
        throw new Error('boom');
      },
    ]);

    const reasons = [degraded, ruleError]
      .filter(isAnalysisFailure)
      .map((outcome) => outcome.reason)
      .sort();

    expect(reasons).toEqual(['analysis-input-degraded', 'analysis-rule-error']);
  });
});

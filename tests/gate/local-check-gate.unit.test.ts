import { describe, expect, it } from 'vitest';
import { LOCAL_CHECK_GATE, localCheckGateScript } from '../../tooling/docs-nav/local-check-gate.js';

describe('LocalCheckGate contract', () => {
  it('names the six Turbo leaf steps in documented cheapest-first order', () => {
    expect(LOCAL_CHECK_GATE).toMatchObject({
      contractName: 'LocalCheckGate',
      excludedFromLocalGate: ['test:smoke'],
    });
    // Six steps: the duplicate unit/int/conf pass has been folded into coverage:baseline.
    expect(LOCAL_CHECK_GATE.steps.map((step) => [step.ordinal, step.script, step.failureToken])).toEqual([
      [1, 'docs:nav:check', 'stale-docs-nav'],
      [2, 'format:check', 'format-failed'],
      [3, 'lint', 'lint-failed'],
      [4, 'deps', 'deps-failed'],
      [5, 'typecheck', 'typecheck-failed'],
      [6, 'coverage:baseline', 'coverage-baseline-failed'],
    ]);
    expect(LOCAL_CHECK_GATE.steps.at(-1)?.command).toBe(
      'vitest run --project unit --project integration --project conformance-mock --coverage --passWithNoTests',
    );
  });

  it('returns the Turbo root-task invocation rather than a plain && chain', () => {
    // The gate is now orchestrated by Turbo (//#check:gate depends on all six leaf tasks).
    // Caching and parallelism are managed by Turbo; the script is a single invocation.
    expect(localCheckGateScript()).toBe('turbo run //#check:gate');
  });
});

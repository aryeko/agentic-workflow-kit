import { describe, expect, it } from 'vitest';
import { LOCAL_CHECK_GATE, localCheckGateScript } from '../../tooling/docs-nav/local-check-gate.js';

describe('LocalCheckGate contract', () => {
  it('names every fail-fast step in documented order', () => {
    expect(LOCAL_CHECK_GATE).toMatchObject({
      contractName: 'LocalCheckGate',
      excludedFromLocalGate: ['test:smoke'],
    });
    expect(LOCAL_CHECK_GATE.steps.map((step) => [step.ordinal, step.script, step.failureToken])).toEqual([
      [1, 'docs:nav:check', 'stale-docs-nav'],
      [2, 'format:check', 'format-failed'],
      [3, 'lint', 'lint-failed'],
      [4, 'deps', 'deps-failed'],
      [5, 'typecheck', 'typecheck-failed'],
      [6, 'test:unit', 'unit-failed'],
      [7, 'test:int', 'integration-failed'],
      [8, 'test:conf', 'conformance-failed'],
      [9, 'coverage:baseline', 'coverage-baseline-failed'],
    ]);
  });

  it('renders the pnpm check command as an && chain so earlier failures stop later steps', () => {
    expect(localCheckGateScript()).toBe(
      'pnpm docs:nav:check && pnpm format:check && pnpm lint && pnpm deps && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm test:conf && pnpm coverage:baseline',
    );
  });
});

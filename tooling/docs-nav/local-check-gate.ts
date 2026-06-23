export type LocalCheckGateFailureToken =
  | 'stale-docs-nav'
  | 'format-failed'
  | 'lint-failed'
  | 'deps-failed'
  | 'typecheck-failed'
  | 'coverage-baseline-failed'
  | 'type-fixtures-failed';

export type LocalCheckGateStep = {
  readonly ordinal: number;
  readonly script: string;
  readonly command: string;
  readonly failureToken: LocalCheckGateFailureToken;
};

export type LocalCheckGate = {
  readonly contractName: 'LocalCheckGate';
  readonly steps: readonly LocalCheckGateStep[];
  readonly excludedFromLocalGate: readonly ['test:smoke'];
};

/**
 * The seven leaf scripts that Turbo orchestrates under //#check:gate.
 * Ordering is cheapest-first for documentation and audit purposes only —
 * Turbo runs all seven in parallel and caches each by its declared inputs.
 * The duplicate unit/int/conf pass has been collapsed: coverage:baseline
 * already runs those three suites under V8 coverage, so the plain test
 * runs are not part of the gate. The type:fixtures leaf compiles every
 * negative/public type-fixture so the compile-time AC proofs are enforced
 * by the standing gate rather than left to a manual one-off.
 */
export const LOCAL_CHECK_GATE: LocalCheckGate = {
  contractName: 'LocalCheckGate',
  steps: [
    {
      ordinal: 1,
      script: 'docs:nav:check',
      command: 'node tooling/docs-nav/generate-nav.mjs --check',
      failureToken: 'stale-docs-nav',
    },
    {
      ordinal: 2,
      script: 'format:check',
      command: 'biome format .',
      failureToken: 'format-failed',
    },
    {
      ordinal: 3,
      script: 'lint',
      command: 'biome lint .',
      failureToken: 'lint-failed',
    },
    {
      ordinal: 4,
      script: 'deps',
      command: 'depcruise --config .dependency-cruiser.cjs packages tooling tests',
      failureToken: 'deps-failed',
    },
    {
      ordinal: 5,
      script: 'typecheck',
      command: 'tsc -b',
      failureToken: 'typecheck-failed',
    },
    {
      ordinal: 6,
      script: 'coverage:baseline',
      command:
        'vitest run --project unit --project integration --project conformance-mock --coverage --passWithNoTests',
      failureToken: 'coverage-baseline-failed',
    },
    {
      ordinal: 7,
      script: 'type:fixtures',
      command: 'node tooling/type-fixtures/run-type-fixtures.ts',
      failureToken: 'type-fixtures-failed',
    },
  ],
  excludedFromLocalGate: ['test:smoke'],
};

/**
 * Returns the Turbo invocation that runs //#check:gate.
 * The aggregate no-op root task depends on all seven leaf tasks declared in
 * LOCAL_CHECK_GATE.steps. The gate script is fixed — the steps array is
 * used for audit/documentation, not for building the shell command.
 */
export const localCheckGateScript = (): string => 'turbo run //#check:gate';

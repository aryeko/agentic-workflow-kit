export type LocalCheckGateFailureToken =
  | 'stale-docs-nav'
  | 'format-failed'
  | 'lint-failed'
  | 'deps-failed'
  | 'typecheck-failed'
  | 'unit-failed'
  | 'integration-failed'
  | 'conformance-failed'
  | 'coverage-baseline-failed';

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
      script: 'test:unit',
      command: 'vitest run --project unit --passWithNoTests',
      failureToken: 'unit-failed',
    },
    {
      ordinal: 7,
      script: 'test:int',
      command: 'vitest run --project integration --passWithNoTests',
      failureToken: 'integration-failed',
    },
    {
      ordinal: 8,
      script: 'test:conf',
      command: 'vitest run --project conformance-mock --passWithNoTests',
      failureToken: 'conformance-failed',
    },
    {
      ordinal: 9,
      script: 'coverage:baseline',
      command:
        'vitest run --project unit --project integration --project conformance-mock --coverage --passWithNoTests',
      failureToken: 'coverage-baseline-failed',
    },
  ],
  excludedFromLocalGate: ['test:smoke'],
};

export const localCheckGateScript = (gate: LocalCheckGate = LOCAL_CHECK_GATE): string =>
  gate.steps.map((step) => `pnpm ${step.script}`).join(' && ');

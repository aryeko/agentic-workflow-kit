// =============================================================================
// Package-agnostic baseline rules for dependency-cruiser.
//
// These rules apply to the entire monorepo regardless of package structure.
// They enforce graph hygiene (no cycles, no orphans) and will grow as the
// package decomposition stabilises.
//
// LAYER-BASED DEPENDENCY RULES — TEMPLATE (not yet activated)
// ─────────────────────────────────────────────────────────────
// Once the package decomposition lands, design owners should activate the
// appropriate layer rules here (or in a separate .dependency-cruiser.layers.cjs
// that this file merges). See docs/foundation/dependency-rule-enforcement.md
// for the intended layering contract.
//
// Example rules (illustrative — DO NOT activate until packages exist):
//
//   {
//     name: 'core-must-not-import-driver',
//     severity: 'error',
//     comment: 'Core packages must not depend on driver adapters.',
//     from: { path: '^packages/core' },
//     to:   { path: '^packages/driver-' },
//   },
//   {
//     name: 'contracts-must-not-import-core',
//     severity: 'error',
//     comment: 'Contract/type packages must remain dependency-free of core logic.',
//     from: { path: '^packages/contracts' },
//     to:   { path: '^packages/core' },
//   },
//   {
//     name: 'ui-must-not-import-server-runtime',
//     severity: 'error',
//     comment: 'UI packages must not pull in server-only runtimes.',
//     from: { path: '^packages/ui' },
//     to:   { path: '^packages/(server|runtime)' },
//   },
//
// =============================================================================

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'No orphan modules (tests/tooling/config/type-decls excluded).',
      from: {
        orphan: true,
        pathNot: [
          '\\.(test|spec)\\.[tj]s$',
          '\\.d\\.ts$',
          '(^|/)tooling/',
          '(^|/)tests/',
          '\\.config\\.[tj]s$',
          '\\.cjs$',
        ],
      },
      to: {},
    },
  ],

  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};

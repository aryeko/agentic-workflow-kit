// =============================================================================
// Package and layer boundary rules for dependency-cruiser.
//
// These rules enforce the Dependency Rule before packages are implemented:
// Edge -> Control plane -> Contracts, Drivers -> Contracts, and everything
// may depend on Foundation. Contracts may depend on Foundation and sibling
// Contracts packages; Foundation must not depend on any layer above it.
//
// =============================================================================

const packagePath = (packageName) => `^packages/${packageName}(?:/|$)`;

const packageGroupPath = (packagePrefix) => `^packages/${packagePrefix}[^/]+(?:/|$)`;

const npmPackagePath = (packageNamePattern) => [
  `(^|/)node_modules/${packageNamePattern}(?:/|$)`,
  `(^|/)node_modules/\\.pnpm/[^/]+/node_modules/${packageNamePattern}(?:/|$)`,
];

const NPM_DEPENDENCY_TYPES = ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg', 'npm-unknown'];

const LAYERS = {
  foundation: packageGroupPath('foundation-'),
  contracts: packageGroupPath('contracts-'),
  core: packageGroupPath('core-'),
  drivers: packageGroupPath('drivers-'),
  edge: packageGroupPath('edge-'),
  compositionRoot: packagePath('composition-root'),
};

const DRIVER_PACKAGES = ['codex', 'github', 'local', 'markdown', 'mocks'];

const peerDriverRules = DRIVER_PACKAGES.map((driverName) => ({
  name: `driver-${driverName}-must-not-import-peer-driver`,
  severity: 'error',
  comment: 'Driver packages must not import peer driver adapters.',
  from: { path: packagePath(`drivers-${driverName}`) },
  to: {
    path: `^packages/drivers-(?!${driverName}(?:/|$))[^/]+(?:/|$)`,
  },
}));

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
    {
      name: 'core-must-not-import-edge-or-driver',
      severity: 'error',
      comment: 'Control-plane packages must not depend on edge entrypoints or concrete drivers.',
      from: { path: LAYERS.core },
      to: { path: `(?:${LAYERS.edge}|${LAYERS.drivers})` },
    },
    {
      name: 'contracts-must-not-import-implementation-layers',
      severity: 'error',
      comment: 'Contracts may depend on foundation and sibling contracts only, never core, edge, or drivers.',
      from: { path: LAYERS.contracts },
      to: { path: `(?:${LAYERS.core}|${LAYERS.edge}|${LAYERS.drivers})` },
    },
    {
      name: 'foundation-must-not-import-upper-layers',
      severity: 'error',
      comment: 'Foundation packages may import foundation peers only; upper layers must depend on foundation instead.',
      from: { path: LAYERS.foundation },
      to: {
        path: `(?:${LAYERS.contracts}|${LAYERS.core}|${LAYERS.edge}|${LAYERS.drivers})`,
      },
    },
    {
      name: 'drivers-must-not-import-core-or-edge',
      severity: 'error',
      comment: 'Drivers implement contracts; they must not reach into the control plane or edge.',
      from: { path: LAYERS.drivers },
      to: { path: `(?:${LAYERS.core}|${LAYERS.edge})` },
    },
    ...peerDriverRules,
    {
      name: 'edge-must-not-import-drivers',
      severity: 'error',
      comment: 'Edge packages call the control plane, not concrete drivers.',
      from: { path: LAYERS.edge },
      to: { path: LAYERS.drivers },
    },
    {
      name: 'lower-layers-must-not-import-composition-root',
      severity: 'error',
      comment: 'Composition root assembles lower layers; lower layers must not depend on it.',
      from: {
        path: `(?:${LAYERS.foundation}|${LAYERS.contracts}|${LAYERS.core}|${LAYERS.drivers}|${LAYERS.edge})`,
      },
      to: { path: LAYERS.compositionRoot },
    },
    {
      name: 'production-must-not-import-test-fixtures',
      severity: 'error',
      comment: 'Production package and tooling source must not import test-only fixtures or conformance helpers.',
      from: {
        path: '^(packages|tooling)/',
        pathNot: [
          '\\.(test|spec)\\.[cm]?[tj]sx?$',
          '(^|/)(__fixtures__|__tests__|test-helpers)(/|$)',
          packagePath('conformance-kit'),
        ],
      },
      to: {
        path: '(^|/)(__fixtures__|__tests__|test-helpers)(/|$)|^packages/conformance-kit(?:/|$)',
      },
    },
    {
      name: 'octokit-github-driver-only',
      severity: 'error',
      comment: 'Octokit imports are allowed only inside the GitHub driver.',
      from: { pathNot: [packagePath('drivers-github')] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('(?:@octokit/[^/]+|octokit)'),
      },
    },
    {
      name: 'execa-local-driver-only',
      severity: 'error',
      comment: 'Execa and native containment helper imports are allowed only inside the local execution-host driver.',
      from: { pathNot: [packagePath('drivers-local')] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('(?:execa|native-containment-helper|@kit-vnext/native-containment-helper)'),
      },
    },
    {
      name: 'telemetry-sdks-edge-or-telemetry-adapter-only',
      severity: 'error',
      comment: 'Pino and OpenTelemetry SDK imports are allowed only in the edge package.',
      from: {
        pathNot: [packagePath('edge-01')],
      },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('(?:pino|@opentelemetry/[^/]+)'),
      },
    },
    {
      name: 'awilix-composition-root-only',
      severity: 'error',
      comment: 'Awilix container imports are allowed only in composition-root.',
      from: { pathNot: [packagePath('composition-root')] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('awilix'),
      },
    },
    {
      name: 'sqlite-storage-package-only',
      severity: 'error',
      comment: 'SQLite imports are allowed only inside the storage package.',
      from: { pathNot: [packagePath('foundation-fnd-02')] },
      to: {
        path: [
          '^node:sqlite$',
          ...npmPackagePath('(?:sqlite|sqlite3|better-sqlite3|libsql|@sqlite\\.org/sqlite-wasm|@libsql/client)'),
        ],
      },
    },
  ],

  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};

// =============================================================================
// Package boundary rules for dependency-cruiser.
//
// The frozen package target is SDK-centered:
//   sdk, cli, mcp, provider-*, testkit
// =============================================================================

const packagePath = (packageName) => `^packages/${packageName}(?:/|$)`;

const packageGroupPath = (packagePrefix) => `^packages/${packagePrefix}[^/]+(?:/|$)`;

const npmPackagePath = (packageNamePattern) => [
  `(^|/)node_modules/${packageNamePattern}(?:/|$)`,
  `(^|/)node_modules/\\.pnpm/[^/]+/node_modules/${packageNamePattern}(?:/|$)`,
];

const NPM_DEPENDENCY_TYPES = ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg', 'npm-unknown'];

const TARGET = {
  sdk: packagePath('sdk'),
  cli: packagePath('cli'),
  mcp: packagePath('mcp'),
  providers: packageGroupPath('provider-'),
  testkit: packagePath('testkit'),
};

const TARGET_PROVIDER_NAMES = ['codex', 'local', 'github', 'markdown'];

const targetProviderPeerRules = TARGET_PROVIDER_NAMES.map((providerName) => ({
  name: `provider-${providerName}-must-not-import-peer-provider`,
  severity: 'error',
  comment: 'Provider packages must not import peer provider packages.',
  from: { path: packagePath(`provider-${providerName}`) },
  to: {
    path: `^packages/provider-(?!${providerName}(?:/|$))[^/]+(?:/|$)`,
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
      name: 'sdk-must-not-import-runtime-packages',
      severity: 'error',
      comment:
        'sdk owns deterministic runtime and provider interfaces; it must not import providers, executables, or testkit.',
      from: { path: TARGET.sdk },
      to: {
        path: `(?:${TARGET.providers}|${TARGET.cli}|${TARGET.mcp}|${TARGET.testkit})`,
      },
    },
    {
      name: 'sdk-must-not-import-banned-external-libraries',
      severity: 'error',
      comment:
        'sdk may import pure runtime libraries only, not provider clients, process helpers, executable runtimes, or parsers.',
      from: { path: TARGET.sdk },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath(
          '(?:@octokit/[^/]+|octokit|execa|native-containment-helper|@kit-vnext/native-containment-helper|@modelcontextprotocol/sdk|commander|yargs|cac|clipanion|ink)',
        ),
      },
    },
    {
      name: 'provider-production-must-not-import-executables-or-testkit',
      severity: 'error',
      comment: 'provider-* production source may import sdk only, not cli, mcp, or testkit.',
      from: {
        path: TARGET.providers,
        pathNot: ['\\.(test|spec)\\.[cm]?[tj]sx?$', '(^|/)(__fixtures__|__tests__|test-helpers)(/|$)'],
      },
      to: { path: `(?:${TARGET.cli}|${TARGET.mcp}|${TARGET.testkit})` },
    },
    ...targetProviderPeerRules,
    {
      name: 'testkit-must-import-sdk-only',
      severity: 'error',
      comment: 'testkit may depend on sdk and its own modules, but not providers or executable packages.',
      from: { path: TARGET.testkit },
      to: { path: `(?:${TARGET.providers}|${TARGET.cli}|${TARGET.mcp})` },
    },
    {
      name: 'production-must-not-import-testkit-or-fixtures',
      severity: 'error',
      comment: 'Production source must not import testkit, conformance helpers, fixtures, or test helpers.',
      from: {
        path: '^(packages|tooling)/',
        pathNot: ['\\.(test|spec)\\.[cm]?[tj]sx?$', '(^|/)(__fixtures__|__tests__|test-helpers)(/|$)', TARGET.testkit],
      },
      to: {
        path: `(?:${TARGET.testkit}|(^|/)(__fixtures__|__tests__|test-helpers)(/|$))`,
      },
    },
    {
      name: 'octokit-github-provider-only',
      severity: 'error',
      comment: 'Octokit imports belong only in provider-github.',
      from: { pathNot: [packagePath('provider-github')] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('(?:@octokit/[^/]+|octokit)'),
      },
    },
    {
      name: 'execa-local-provider-only',
      severity: 'error',
      comment: 'Execa and native containment helper imports belong only in provider-local.',
      from: { pathNot: [packagePath('provider-local')] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('(?:execa|native-containment-helper|@kit-vnext/native-containment-helper)'),
      },
    },
    {
      name: 'mcp-runtime-mcp-only',
      severity: 'error',
      comment: 'MCP server runtime imports belong only in mcp.',
      from: { pathNot: [TARGET.mcp] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('@modelcontextprotocol/sdk'),
      },
    },
    {
      name: 'cli-parser-cli-only',
      severity: 'error',
      comment: 'CLI parser and terminal rendering imports belong only in cli.',
      from: { pathNot: [TARGET.cli] },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('(?:commander|yargs|cac|clipanion|ink)'),
      },
    },
    {
      name: 'no-runtime-di-container',
      severity: 'error',
      comment: 'Runtime packages use explicit factory injection; dependency injection containers are not allowed.',
      from: { path: '^packages/' },
      to: {
        dependencyTypes: NPM_DEPENDENCY_TYPES,
        path: npmPackagePath('awilix'),
      },
    },
    {
      name: 'sqlite-store-adapter-only',
      severity: 'error',
      comment: 'Native-backed stores belong in a store adapter package, never in sdk.',
      from: { pathNot: [packageGroupPath('store-')] },
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

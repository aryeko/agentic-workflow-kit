import {
  PACKAGE_EXPORT_CONVENTION,
  createPackageExportInventory,
  type PackageExportInventory,
  type PackageTemplateFailureToken,
} from '../package-exports/export-convention.js';

export type PackageId =
  | 'cli'
  | 'mcp'
  | 'provider-codex'
  | 'provider-github'
  | 'provider-local'
  | 'provider-markdown'
  | 'sdk'
  | 'testkit';

export type WorkspacePackageManifest = {
  readonly packageId: PackageId;
  readonly packageRoot: `packages/${PackageId}`;
  readonly packageName: PackageId;
  readonly role: string;
  readonly moduleType: 'module';
  readonly private: true;
  readonly allowedWorkspaceDependencies: readonly PackageId[];
};

export type CompositePackageProject = {
  readonly extends: '../../tsconfig.base.json';
  readonly compilerOptions: {
    readonly composite: true;
    readonly declaration: true;
    readonly declarationMap: true;
    readonly outDir: './dist';
    readonly rootDir: '.';
  };
  readonly include: readonly ['package.json', 'src/**/*.ts', 'src/**/*.tsx'];
  readonly references: readonly { readonly path: `../${PackageId}` }[];
};

export type PackageTemplateContract = {
  readonly contractName: 'PackageTemplateContract';
  readonly exportConventionName: 'PackageExportConvention';
  readonly consumes: readonly ['WorkspacePackageManifest', 'CompositePackageProject'];
  readonly generatedPaths: readonly [
    'README.md',
    'package.json',
    'src/README.md',
    'src/index.ts',
    'tests/README.md',
    'tests/<package-id>.unit.test.ts',
    'tests/<package-id>.int.test.ts',
    'tests/<package-id>.conformance.test.ts',
    'tests/<package-id>.smoke.test.ts',
    'tsconfig.json',
  ];
  readonly evidenceRecords: readonly ['template validation report', 'package export inventory'];
  readonly failureTokens: readonly ['export-map-missing', 'template-drift', 'template-forbidden-import'];
};

export type PackageTemplateTarget = WorkspacePackageManifest & {
  readonly description: string;
};

export type PackageTemplateApplication = {
  readonly packageId: PackageId;
  readonly packageRoot: `packages/${PackageId}`;
  readonly files: Readonly<Record<string, string>>;
  readonly packageJson: PackageJson;
  readonly tsconfig: CompositePackageProject;
  readonly testLanes: PackageTemplateTestLanes;
};

export type PackageTemplateTestLanes = {
  readonly unit: readonly string[];
  readonly integration: readonly string[];
  readonly conformanceMock: readonly string[];
  readonly smokeReal: readonly string[];
};

export type PackageJson = {
  readonly name: PackageId;
  readonly version: '0.0.0';
  readonly description: string;
  readonly private: true;
  readonly type: 'module';
  readonly files: readonly ['README.md', 'dist', 'src'];
  readonly exports: {
    readonly '.': {
      readonly types: './dist/src/index.d.ts';
      readonly import: './dist/src/index.js';
    };
  };
  readonly scripts: {
    readonly build: 'tsc -b';
    readonly test: 'vitest run --passWithNoTests';
    readonly typecheck: 'tsc -b';
  };
  readonly dependencies: Readonly<Record<string, 'workspace:*'>>;
};

export type TemplateValidationFailure = {
  readonly token: Extract<PackageTemplateFailureToken, 'template-forbidden-import'>;
  readonly packageId: PackageId;
  readonly message: string;
};

export type TemplateValidationPackageEntry = {
  readonly packageId: PackageId;
  readonly packageRoot: `packages/${PackageId}`;
  readonly workspaceDependencies: readonly PackageId[];
  readonly generatedPaths: readonly string[];
};

export type TemplateValidationReport = {
  readonly contractName: 'PackageTemplateContract';
  readonly valid: boolean;
  readonly packages: readonly TemplateValidationPackageEntry[];
  readonly exportInventory: PackageExportInventory;
  readonly failures: readonly TemplateValidationFailure[];
};

export type TemplateDriftReport = {
  readonly token: 'template-drift';
  readonly changedPaths: readonly string[];
};

export const PACKAGE_TEMPLATE_CONTRACT = {
  contractName: 'PackageTemplateContract',
  exportConventionName: PACKAGE_EXPORT_CONVENTION.contractName,
  consumes: ['WorkspacePackageManifest', 'CompositePackageProject'],
  generatedPaths: [
    'README.md',
    'package.json',
    'src/README.md',
    'src/index.ts',
    'tests/README.md',
    'tests/<package-id>.unit.test.ts',
    'tests/<package-id>.int.test.ts',
    'tests/<package-id>.conformance.test.ts',
    'tests/<package-id>.smoke.test.ts',
    'tsconfig.json',
  ],
  evidenceRecords: ['template validation report', 'package export inventory'],
  failureTokens: ['export-map-missing', 'template-drift', 'template-forbidden-import'],
} as const satisfies PackageTemplateContract;

const targets = [
  {
    packageId: 'cli',
    packageRoot: 'packages/cli',
    packageName: 'cli',
    role: 'terminal executable; provider wiring; filesystem store wiring',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk'],
    description: 'Terminal executable package template for kit-vnext.',
  },
  {
    packageId: 'mcp',
    packageRoot: 'packages/mcp',
    packageName: 'mcp',
    role: 'MCP server executable; provider wiring; filesystem store wiring',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk'],
    description: 'MCP server executable package template for kit-vnext.',
  },
  {
    packageId: 'provider-codex',
    packageRoot: 'packages/provider-codex',
    packageName: 'provider-codex',
    role: 'AgentProvider driver for the Codex protocol',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['sdk'],
    description: 'Codex agent provider package template for kit-vnext.',
  },
  {
    packageId: 'provider-github',
    packageRoot: 'packages/provider-github',
    packageName: 'provider-github',
    role: 'ForgeProvider driver for GitHub push, pull request, and merge operations',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['sdk'],
    description: 'GitHub forge provider package template for kit-vnext.',
  },
  {
    packageId: 'provider-local',
    packageRoot: 'packages/provider-local',
    packageName: 'provider-local',
    role: 'ExecutionHostProvider driver for local execution',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['sdk'],
    description: 'Local execution host provider package template for kit-vnext.',
  },
  {
    packageId: 'provider-markdown',
    packageRoot: 'packages/provider-markdown',
    packageName: 'provider-markdown',
    role: 'WorkSourceProvider driver for Markdown task tracking',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['sdk'],
    description: 'Markdown work source provider package template for kit-vnext.',
  },
  {
    packageId: 'sdk',
    packageRoot: 'packages/sdk',
    packageName: 'sdk',
    role: 'core runtime library; provider interfaces; storage ports and defaults',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: [],
    description: 'Core runtime library package template for kit-vnext.',
  },
  {
    packageId: 'testkit',
    packageRoot: 'packages/testkit',
    packageName: 'testkit',
    role: 'test-only provider mocks, conformance helpers, and incident fixtures',
    moduleType: 'module',
    private: true,
    allowedWorkspaceDependencies: ['sdk'],
    description: 'Test-only provider mock and conformance helper package template for kit-vnext.',
  },
] as const satisfies readonly PackageTemplateTarget[];

export const packageTemplateTargets = {
  cli: targets[0],
  mcp: targets[1],
  providerCodex: targets[2],
  providerGithub: targets[3],
  providerLocal: targets[4],
  providerMarkdown: targets[5],
  sdk: targets[6],
  testkit: targets[7],
  all: targets,
} as const;

export const applyPackageTemplate = (target: PackageTemplateTarget): PackageTemplateApplication => {
  const packageJson = createPackageJson(target);
  const tsconfig = createTsconfig(target);
  const testLanes = createTestLanes(target);
  const files = {
    [`${target.packageRoot}/README.md`]: createPackageReadme(target),
    [`${target.packageRoot}/package.json`]: stableJson(packageJson),
    [`${target.packageRoot}/src/README.md`]: `# ${target.packageId} source\n\nReserved for package-local public source.\n`,
    [`${target.packageRoot}/src/index.ts`]: createIndexSource(target),
    [`${target.packageRoot}/tests/README.md`]: `# ${target.packageId} tests\n\nReserved for package-local tests.\n`,
    [testLanes.unit[0]]: createLaneMarker(target, 'unit'),
    [testLanes.integration[0]]: createLaneMarker(target, 'integration'),
    [testLanes.conformanceMock[0]]: createLaneMarker(target, 'conformanceMock'),
    [testLanes.smokeReal[0]]: createLaneMarker(target, 'smokeReal'),
    [`${target.packageRoot}/tsconfig.json`]: stableJson(tsconfig),
  };

  return {
    packageId: target.packageId,
    packageRoot: target.packageRoot,
    files,
    packageJson,
    tsconfig,
    testLanes,
  };
};

export const createTemplateValidationReport = (
  packageTargets: readonly PackageTemplateTarget[],
): TemplateValidationReport => {
  const applications = packageTargets.map((target) => applyPackageTemplate(target));
  const packages = applications.map((application) => ({
    packageId: application.packageId,
    packageRoot: application.packageRoot,
    workspaceDependencies: Object.keys(application.packageJson.dependencies).sort() as PackageId[],
    generatedPaths: Object.keys(application.files).sort(),
  }));
  const failures = applications.flatMap((application) => validateApplication(application));
  const exportInventory = createPackageExportInventory(applications);

  return {
    contractName: PACKAGE_TEMPLATE_CONTRACT.contractName,
    valid: failures.length === 0 && exportInventory.failures.length === 0,
    packages,
    exportInventory,
    failures,
  };
};

export const diffTemplateApplications = (
  previous: PackageTemplateApplication,
  next: PackageTemplateApplication,
): TemplateDriftReport => {
  const previousPaths = Object.keys(previous.files);
  const nextPaths = Object.keys(next.files);
  const changedPaths = [...new Set([...previousPaths, ...nextPaths])]
    .filter((path) => previous.files[path] !== next.files[path])
    .sort();

  return {
    token: 'template-drift',
    changedPaths,
  };
};

const createPackageJson = (target: PackageTemplateTarget): PackageJson => ({
  name: target.packageName,
  version: '0.0.0',
  description: target.description,
  private: target.private,
  type: target.moduleType,
  files: ['README.md', 'dist', 'src'],
  exports: {
    '.': {
      types: './dist/src/index.d.ts',
      import: './dist/src/index.js',
    },
  },
  scripts: {
    build: 'tsc -b',
    test: 'vitest run --passWithNoTests',
    typecheck: 'tsc -b',
  },
  dependencies: Object.fromEntries(
    target.allowedWorkspaceDependencies.map((dependency) => [dependency, 'workspace:*'] as const),
  ) as Readonly<Record<string, 'workspace:*'>>,
});

const createTsconfig = (target: PackageTemplateTarget): CompositePackageProject => ({
  extends: '../../tsconfig.base.json',
  compilerOptions: {
    composite: true,
    declaration: true,
    declarationMap: true,
    outDir: './dist',
    rootDir: '.',
  },
  include: ['package.json', 'src/**/*.ts', 'src/**/*.tsx'],
  references: target.allowedWorkspaceDependencies.map((dependency) => ({ path: `../${dependency}` })),
});

const createTestLanes = (target: PackageTemplateTarget): PackageTemplateTestLanes => ({
  unit: [`${target.packageRoot}/tests/${target.packageId}.unit.test.ts`],
  integration: [`${target.packageRoot}/tests/${target.packageId}.int.test.ts`],
  conformanceMock: [`${target.packageRoot}/tests/${target.packageId}.conformance.test.ts`],
  smokeReal: [`${target.packageRoot}/tests/${target.packageId}.smoke.test.ts`],
});

const createPackageReadme = (target: PackageTemplateTarget): string => `# ${target.packageId}

${target.description}

## WorkspacePackageManifest

| field | value |
|---|---|
| packageId | \`${target.packageId}\` |
| packageRoot | \`${target.packageRoot}\` |
| packageName | \`${target.packageName}\` |
| role | ${target.role} |
| moduleType | \`${target.moduleType}\` |
| private | \`${String(target.private)}\` |
| allowedWorkspaceDependencies | ${formatDependencies(target.allowedWorkspaceDependencies)} |
`;

const createIndexSource = (target: PackageTemplateTarget): string => {
  const typeName = `${toPascalCase(target.packageId)}PublicSurface`;

  return `export type ${typeName} = {
  readonly packageId: '${target.packageId}';
};
`;
};

const createLaneMarker = (target: PackageTemplateTarget, lane: keyof PackageTemplateTestLanes): string => {
  const exportName = `${toCamelCase(target.packageId)}${toPascalCase(lane)}TemplateLane`;
  const publicTypeName = `${toPascalCase(target.packageId)}PublicSurface`;

  return `import type { ${publicTypeName} } from '../src/index.js';

export type ${toPascalCase(exportName)} = ${publicTypeName};
export const ${exportName} = '${lane}';
`;
};

const validateApplication = (application: PackageTemplateApplication): readonly TemplateValidationFailure[] => {
  const forbiddenContent = Object.entries(application.files).flatMap(([path, content]) =>
    containsForbiddenTemplateContent(content)
      ? [
          {
            token: 'template-forbidden-import',
            packageId: application.packageId,
            message: `Generated file ${path} contains forbidden template content.`,
          } satisfies TemplateValidationFailure,
        ]
      : [],
  );

  return forbiddenContent;
};

const containsForbiddenTemplateContent = (content: string): boolean =>
  [
    'node:child_process',
    'child_process',
    '@octokit/',
    'execa',
    '@modelcontextprotocol/sdk',
    'commander',
    'fetch(',
    'process.env',
    'GITHUB_TOKEN',
    'OPENAI_API_KEY',
    'SECRET',
  ].some((forbidden) => content.includes(forbidden));

const formatDependencies = (dependencies: readonly PackageId[]): string =>
  dependencies.length === 0 ? 'none' : dependencies.map((dependency) => `\`${dependency}\``).join(', ');

const stableJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const toPascalCase = (value: string): string =>
  value
    .split(/[-_]/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');

const toCamelCase = (value: string): string => {
  const pascal = toPascalCase(value);

  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
};

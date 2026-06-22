export type PackageId =
  | 'cli'
  | 'mcp'
  | 'provider-codex'
  | 'provider-github'
  | 'provider-local'
  | 'provider-markdown'
  | 'sdk'
  | 'testkit';

export type TypecheckProjectFailureToken =
  | 'project-reference-missing'
  | 'forbidden-ts-reference'
  | 'non-composite-package-project';

export type TsconfigReference = {
  readonly path: string;
};

export type RootTypecheckSolution = {
  readonly files: readonly [];
  readonly references: readonly TsconfigReference[];
};

export type CompositePackageProject = {
  readonly packageId: PackageId;
  readonly packageRoot: `packages/${PackageId}`;
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

export type TypecheckProjectReference = {
  readonly from: 'root' | PackageId;
  readonly to: 'infra' | PackageId;
  readonly path: string;
};

export type TypecheckProjectFailure = {
  readonly token: TypecheckProjectFailureToken;
  readonly project: 'root' | PackageId;
  readonly message: string;
};

export type TypecheckProjectGraph = {
  readonly contractName: 'TypecheckProjectGraph';
  readonly packages: readonly CompositePackageProject[];
  readonly rootReferences: readonly TypecheckProjectReference[];
  readonly packageReferences: readonly TypecheckProjectReference[];
  readonly failures: readonly TypecheckProjectFailure[];
  readonly valid: boolean;
};

export type PackageTsconfigSource = {
  readonly packageId: PackageId;
  readonly config: unknown;
};

export const TYPECHECK_PROJECT_FAILURE_TOKENS = [
  'project-reference-missing',
  'forbidden-ts-reference',
  'non-composite-package-project',
] as const satisfies readonly TypecheckProjectFailureToken[];

export const TYPECHECK_PROJECT_PACKAGE_IDS = [
  'cli',
  'mcp',
  'provider-codex',
  'provider-github',
  'provider-local',
  'provider-markdown',
  'sdk',
  'testkit',
] as const satisfies readonly PackageId[];

const allowedPackageReferences = {
  cli: ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk'],
  mcp: ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk'],
  'provider-codex': ['sdk'],
  'provider-github': ['sdk'],
  'provider-local': ['sdk'],
  'provider-markdown': ['sdk'],
  sdk: [],
  testkit: ['sdk'],
} as const satisfies Readonly<Record<PackageId, readonly PackageId[]>>;

export const createTypecheckProjectGraph = (
  rootConfig: RootTypecheckSolution,
  packageConfigs: readonly PackageTsconfigSource[],
): TypecheckProjectGraph => {
  const packageConfigById = new Map(packageConfigs.map((source) => [source.packageId, source.config]));
  const packages = TYPECHECK_PROJECT_PACKAGE_IDS.flatMap((packageId) =>
    toCompositePackageProject(packageId, packageConfigById.get(packageId)),
  );
  const rootReferences = normalizeRootReferences(rootConfig);
  const packageReferences = packages.flatMap((project) =>
    project.references.flatMap((reference) => {
      const referencedPackageId = packageIdFromReferencePath(reference.path);

      return referencedPackageId
        ? [
            {
              from: project.packageId,
              to: referencedPackageId,
              path: reference.path,
            },
          ]
        : [];
    }),
  );
  const failures = [
    ...collectMissingRootReferences(rootReferences),
    ...collectMissingPackageConfigs(packageConfigById),
    ...collectNonCompositeFailures(packageConfigs),
    ...collectMissingPackageReferences(packages),
    ...collectForbiddenPackageReferences(packageReferences),
  ];

  return {
    contractName: 'TypecheckProjectGraph',
    packages,
    rootReferences,
    packageReferences,
    failures,
    valid: failures.length === 0,
  };
};

const normalizeRootReferences = (rootConfig: RootTypecheckSolution): readonly TypecheckProjectReference[] =>
  rootConfig.references
    .map((reference) => {
      const packageId = packageIdFromReferencePath(reference.path);

      return {
        from: 'root',
        to: packageId ?? (reference.path === './tsconfig.infra.json' ? 'infra' : reference.path),
        path: reference.path,
      };
    })
    .filter((reference): reference is TypecheckProjectReference => isKnownRootReference(reference.to))
    .sort((left, right) => left.path.localeCompare(right.path));

const collectMissingRootReferences = (
  rootReferences: readonly TypecheckProjectReference[],
): readonly TypecheckProjectFailure[] => {
  const actualPaths = new Set(rootReferences.map((reference) => reference.path));
  const requiredPaths = [
    './tsconfig.infra.json',
    ...TYPECHECK_PROJECT_PACKAGE_IDS.map((packageId) => `./packages/${packageId}`),
  ];

  return requiredPaths
    .filter((path) => !actualPaths.has(path))
    .map((path) => ({
      token: 'project-reference-missing',
      project: 'root',
      message: `Root TypeScript solution must reference ${path}.`,
    }));
};

const collectMissingPackageConfigs = (
  packageConfigById: ReadonlyMap<PackageId, unknown>,
): readonly TypecheckProjectFailure[] =>
  TYPECHECK_PROJECT_PACKAGE_IDS.filter((packageId) => !packageConfigById.has(packageId)).map((packageId) => ({
    token: 'project-reference-missing',
    project: packageId,
    message: `Package ${packageId} is missing packages/${packageId}/tsconfig.json.`,
  }));

const collectNonCompositeFailures = (
  packageConfigs: readonly PackageTsconfigSource[],
): readonly TypecheckProjectFailure[] =>
  packageConfigs
    .filter((source) => !isCompositePackageProjectConfig(source.packageId, source.config))
    .map((source) => ({
      token: 'non-composite-package-project',
      project: source.packageId,
      message: `Package ${source.packageId} must be a composite package project with declaration output.`,
    }));

const collectMissingPackageReferences = (
  packages: readonly CompositePackageProject[],
): readonly TypecheckProjectFailure[] =>
  packages.flatMap((project) => {
    const actualReferences = new Set(project.references.map((reference) => packageIdFromReferencePath(reference.path)));

    return allowedPackageReferences[project.packageId]
      .filter((requiredPackageId) => !actualReferences.has(requiredPackageId))
      .map((requiredPackageId) => ({
        token: 'project-reference-missing',
        project: project.packageId,
        message: `Package ${project.packageId} must reference allowed dependency ${requiredPackageId}.`,
      }));
  });

const collectForbiddenPackageReferences = (
  packageReferences: readonly TypecheckProjectReference[],
): readonly TypecheckProjectFailure[] =>
  packageReferences
    .filter(isPackageProjectReference)
    .filter((reference) => !(allowedPackageReferences[reference.from] as readonly PackageId[]).includes(reference.to))
    .map((reference) => ({
      token: 'forbidden-ts-reference',
      project: reference.from,
      message: `Package ${reference.from} must not reference forbidden package ${reference.to}.`,
    }));

const isPackageProjectReference = (
  reference: TypecheckProjectReference,
): reference is TypecheckProjectReference & { readonly from: PackageId; readonly to: PackageId } =>
  reference.from !== 'root' && isPackageId(reference.to);

const toCompositePackageProject = (packageId: PackageId, config: unknown): readonly CompositePackageProject[] => {
  if (!isCompositePackageProjectConfig(packageId, config)) {
    return [];
  }

  return [
    {
      packageId,
      packageRoot: `packages/${packageId}`,
      extends: config.extends,
      compilerOptions: config.compilerOptions,
      include: config.include,
      references: config.references,
    },
  ];
};

const isCompositePackageProjectConfig = (
  packageId: PackageId,
  config: unknown,
): config is Omit<CompositePackageProject, 'packageId' | 'packageRoot'> => {
  if (!isRecord(config) || !isRecord(config.compilerOptions) || !Array.isArray(config.include)) {
    return false;
  }

  return (
    config.extends === '../../tsconfig.base.json' &&
    config.compilerOptions.composite === true &&
    config.compilerOptions.declaration === true &&
    config.compilerOptions.declarationMap === true &&
    config.compilerOptions.outDir === './dist' &&
    config.compilerOptions.rootDir === '.' &&
    JSON.stringify(config.include) === JSON.stringify(['package.json', 'src/**/*.ts', 'src/**/*.tsx']) &&
    referencesArePackagePaths(packageId, config.references)
  );
};

const referencesArePackagePaths = (
  packageId: PackageId,
  references: unknown,
): references is CompositePackageProject['references'] =>
  Array.isArray(references) &&
  references.every((reference) => {
    if (!isRecord(reference) || typeof reference.path !== 'string') {
      return false;
    }

    const referencedPackageId = packageIdFromReferencePath(reference.path);

    return referencedPackageId !== undefined && referencedPackageId !== packageId;
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const packageIdFromReferencePath = (path: string): PackageId | undefined => {
  const packageId = path
    .replace(/^\.\//, '')
    .replace(/^packages\//, '')
    .replace(/^\.\.\//, '');

  return isPackageId(packageId) ? packageId : undefined;
};

const isPackageId = (value: unknown): value is PackageId =>
  typeof value === 'string' && TYPECHECK_PROJECT_PACKAGE_IDS.includes(value as PackageId);

const isKnownRootReference = (value: unknown): value is 'infra' | PackageId => value === 'infra' || isPackageId(value);

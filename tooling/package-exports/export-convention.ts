export type PackageTemplateFailureToken = 'export-map-missing' | 'template-drift' | 'template-forbidden-import';

export type PackageExportConvention = {
  readonly contractName: 'PackageExportConvention';
  readonly requiredPublicEntrypoints: readonly ['.'];
  readonly forbiddenExportPathPatterns: readonly string[];
  readonly failureToken: 'export-map-missing';
};

export type PackageExportFailure = {
  readonly token: 'export-map-missing';
  readonly packageId: string;
  readonly message: string;
};

export type PackageExportMap = Readonly<Record<string, unknown>> | string | undefined;

export type PackageExportInventoryEntry = {
  readonly packageId: string;
  readonly publicEntrypoints: readonly string[];
  readonly exposedForbiddenEntrypoints: readonly string[];
  readonly failures: readonly PackageExportFailure[];
};

export type PackageExportInventory = {
  readonly conventionName: 'PackageExportConvention';
  readonly packages: readonly PackageExportInventoryEntry[];
  readonly failures: readonly PackageExportFailure[];
  readonly exposedForbiddenEntrypoints: readonly PackageExportInventoryEntry[];
};

export type PackageExportInventorySource = {
  readonly packageId: string;
  readonly packageJson: {
    readonly exports?: PackageExportMap;
  };
};

export const PACKAGE_EXPORT_CONVENTION = {
  contractName: 'PackageExportConvention',
  requiredPublicEntrypoints: ['.'],
  forbiddenExportPathPatterns: [
    'tests',
    '__tests__',
    'fixtures',
    '__fixtures__',
    'tooling',
    'internal',
    'src/internal',
  ],
  failureToken: 'export-map-missing',
} as const satisfies PackageExportConvention;

export const validatePackageExportMap = (
  packageId: string,
  exportsMap: PackageExportMap,
): PackageExportInventoryEntry => {
  const exportEntries = normalizeExportEntries(exportsMap);
  const publicEntrypoints = exportEntries
    .filter(([entrypoint]) => entrypoint === '.')
    .map(([entrypoint]) => entrypoint)
    .sort();
  const exposedForbiddenEntrypoints = exportEntries
    .filter(([entrypoint, target]) => exposesForbiddenPath(entrypoint, target))
    .map(([entrypoint]) => entrypoint)
    .sort();
  const failures = publicEntrypoints.includes('.')
    ? []
    : [
        {
          token: 'export-map-missing',
          packageId,
          message: `Package ${packageId} must export the public "." entrypoint.`,
        } satisfies PackageExportFailure,
      ];

  return {
    packageId,
    publicEntrypoints,
    exposedForbiddenEntrypoints,
    failures,
  };
};

export const createPackageExportInventory = (
  sources: readonly PackageExportInventorySource[],
): PackageExportInventory => {
  const packages = sources
    .map((source) => validatePackageExportMap(source.packageId, source.packageJson.exports))
    .sort((left, right) => left.packageId.localeCompare(right.packageId));

  return {
    conventionName: PACKAGE_EXPORT_CONVENTION.contractName,
    packages,
    failures: packages.flatMap((entry) => entry.failures),
    exposedForbiddenEntrypoints: packages.filter((entry) => entry.exposedForbiddenEntrypoints.length > 0),
  };
};

const normalizeExportEntries = (exportsMap: PackageExportMap): readonly (readonly [string, unknown])[] => {
  if (typeof exportsMap === 'string') {
    return [['.', exportsMap]];
  }

  if (!exportsMap || Array.isArray(exportsMap)) {
    return [];
  }

  return Object.entries(exportsMap).sort(([left], [right]) => left.localeCompare(right));
};

const exposesForbiddenPath = (entrypoint: string, target: unknown): boolean => {
  const serializedTarget = typeof target === 'string' ? target : JSON.stringify(target);
  const inspectedPaths = [entrypoint, ...(serializedTarget ? extractStringValues(serializedTarget) : [])];

  return inspectedPaths.some((path) => hasForbiddenPathSegment(path));
};

const extractStringValues = (serializedValue: string): readonly string[] => {
  try {
    const parsedValue = JSON.parse(serializedValue) as unknown;

    return collectStringValues(parsedValue);
  } catch {
    return [serializedValue];
  }
};

const collectStringValues = (value: unknown): readonly string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStringValues(entry));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((entry) => collectStringValues(entry));
  }

  return [];
};

const hasForbiddenPathSegment = (path: string): boolean => {
  const pathSegments = pathSegmentsFor(path);

  return PACKAGE_EXPORT_CONVENTION.forbiddenExportPathPatterns.some((pattern) => {
    const patternSegments = pathSegmentsFor(pattern);

    return containsSegmentSequence(pathSegments, patternSegments);
  });
};

const containsSegmentSequence = (pathSegments: readonly string[], patternSegments: readonly string[]): boolean => {
  if (patternSegments.length === 0 || pathSegments.length < patternSegments.length) {
    return false;
  }

  return pathSegments.some((_, startIndex) =>
    patternSegments.every((segment, offset) => pathSegments[startIndex + offset] === segment),
  );
};

const pathSegmentsFor = (path: string): readonly string[] =>
  normalizePathForSegments(path)
    .split('/')
    .filter((segment) => segment.length > 0);

const normalizePathForSegments = (path: string): string =>
  path
    .replace(/^\.\/?/, '')
    .replace(/^\/+/, '')
    .replace(/^dist\//, '')
    .replace(/^src\//, '')
    .replace(/\/index\.(?:[cm]?[jt]sx?|d\.ts)$/, '')
    .replace(/\.(?:[cm]?[jt]sx?|d\.ts)$/, '')
    .replace(/\/+$/, '');

import { describe, expect, it } from 'vitest';
import {
  PACKAGE_EXPORT_CONVENTION,
  createPackageExportInventory,
  validatePackageExportMap,
} from '../../tooling/package-exports/export-convention.js';
import { applyPackageTemplate, packageTemplateTargets } from '../../tooling/package-templates/package-template.js';

describe('PackageExportConvention', () => {
  it('exposes public entrypoints and blocks tests, fixtures, tooling, and internals', () => {
    const inventory = createPackageExportInventory(
      packageTemplateTargets.all.map((target) => applyPackageTemplate(target)),
    );

    expect(inventory.conventionName).toBe('PackageExportConvention');
    expect(inventory.packages).toHaveLength(8);
    expect(inventory.packages.every((entry) => entry.publicEntrypoints.includes('.'))).toBe(true);
    expect(inventory.packages.flatMap((entry) => entry.exposedForbiddenEntrypoints)).toEqual([]);
    expect(inventory.failures).toEqual([]);
  });

  it('reports export-map-missing when the required public entrypoint is absent', () => {
    expect(validatePackageExportMap('sdk', {})).toEqual({
      packageId: 'sdk',
      publicEntrypoints: [],
      exposedForbiddenEntrypoints: [],
      failures: [
        {
          token: 'export-map-missing',
          packageId: 'sdk',
          message: 'Package sdk must export the public "." entrypoint.',
        },
      ],
    });
  });

  it('accepts string shorthand exports as the public package entrypoint', () => {
    expect(validatePackageExportMap('sdk', './dist/src/index.js')).toEqual({
      packageId: 'sdk',
      publicEntrypoints: ['.'],
      exposedForbiddenEntrypoints: [],
      failures: [],
    });
  });

  it('records forbidden export subpaths without treating them as public entrypoints', () => {
    expect(
      validatePackageExportMap('sdk', {
        '.': './dist/src/index.js',
        './fixtures': './dist/src/public-fixtures.js',
        './helpers/fixtures/data': './dist/src/public-fixture-data.js',
        './internal': './dist/src/public-internal.js',
        './internal/testing': './dist/src/internal/testing.js',
        './tests': './dist/src/public-tests.js',
        './tests/fixtures': './dist/tests/fixtures.js',
        './debug/internal/state': './dist/src/public-debug-state.js',
        './tooling': './dist/src/public-tooling.js',
        './tooling/helpers': './dist/src/tooling/helpers.js',
      }),
    ).toEqual({
      packageId: 'sdk',
      publicEntrypoints: ['.'],
      exposedForbiddenEntrypoints: [
        './debug/internal/state',
        './fixtures',
        './helpers/fixtures/data',
        './internal',
        './internal/testing',
        './tests',
        './tests/fixtures',
        './tooling',
        './tooling/helpers',
      ],
      failures: [],
    });
  });

  it('handles undefined export targets while checking forbidden export keys', () => {
    expect(
      validatePackageExportMap('sdk', {
        '.': undefined,
        './fixtures': undefined,
      }),
    ).toEqual({
      packageId: 'sdk',
      publicEntrypoints: ['.'],
      exposedForbiddenEntrypoints: ['./fixtures'],
      failures: [],
    });
  });

  it('records forbidden nested target paths even when export keys look public', () => {
    expect(
      validatePackageExportMap('sdk', {
        '.': './dist/src/index.js',
        './debug-state': './dist/src/public/internal/state.js',
        './helper-data': './dist/src/helpers/fixtures/data.js',
        './testing-support': {
          import: './dist/src/__fixtures__/support.js',
          types: './dist/src/__fixtures__/support.d.ts',
        },
        './tools': './dist/tooling/index.js',
      }),
    ).toEqual({
      packageId: 'sdk',
      publicEntrypoints: ['.'],
      exposedForbiddenEntrypoints: ['./debug-state', './helper-data', './testing-support', './tools'],
      failures: [],
    });
  });

  it('treats malformed export map values as missing public exports', () => {
    expect(validatePackageExportMap('sdk', undefined).failures).toEqual([
      {
        token: 'export-map-missing',
        packageId: 'sdk',
        message: 'Package sdk must export the public "." entrypoint.',
      },
    ]);
    expect(validatePackageExportMap('sdk', [] as unknown as Record<string, unknown>).failures).toEqual([
      {
        token: 'export-map-missing',
        packageId: 'sdk',
        message: 'Package sdk must export the public "." entrypoint.',
      },
    ]);
  });

  it('keeps forbidden export path patterns in the reusable convention artifact', () => {
    expect(PACKAGE_EXPORT_CONVENTION.forbiddenExportPathPatterns).toEqual([
      'tests',
      '__tests__',
      'fixtures',
      '__fixtures__',
      'tooling',
      'internal',
      'src/internal',
    ]);
  });
});

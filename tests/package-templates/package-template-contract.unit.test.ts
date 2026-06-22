import { describe, expect, it } from 'vitest';
import {
  PACKAGE_TEMPLATE_CONTRACT,
  applyPackageTemplate,
  createTemplateValidationReport,
  isTemplateValidationReportValid,
  packageTemplateTargets,
} from '../../tooling/package-templates/package-template.js';

describe('PackageTemplateContract', () => {
  it('names the S4 contract, export convention, evidence records, and failure tokens', () => {
    expect(PACKAGE_TEMPLATE_CONTRACT).toMatchObject({
      contractName: 'PackageTemplateContract',
      exportConventionName: 'PackageExportConvention',
      evidenceRecords: ['template validation report', 'package export inventory'],
      failureTokens: ['export-map-missing', 'template-drift', 'template-forbidden-import'],
    });
  });

  it('creates package-local source, tests, manifest, and composite tsconfig files', () => {
    const sdkTemplate = applyPackageTemplate(packageTemplateTargets.sdk);

    expect(Object.keys(sdkTemplate.files).sort()).toEqual([
      'packages/sdk/README.md',
      'packages/sdk/package.json',
      'packages/sdk/src/README.md',
      'packages/sdk/src/index.ts',
      'packages/sdk/tests/README.md',
      'packages/sdk/tests/sdk.conformance.test.ts',
      'packages/sdk/tests/sdk.int.test.ts',
      'packages/sdk/tests/sdk.smoke.test.ts',
      'packages/sdk/tests/sdk.unit.test.ts',
      'packages/sdk/tsconfig.json',
    ]);
    expect(JSON.parse(sdkTemplate.files['packages/sdk/package.json'])).toMatchObject({
      name: 'sdk',
      private: true,
      type: 'module',
      dependencies: {},
      exports: {
        '.': {
          types: './dist/src/index.d.ts',
          import: './dist/src/index.js',
        },
      },
    });
    expect(JSON.parse(sdkTemplate.files['packages/sdk/tsconfig.json'])).toMatchObject({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        composite: true,
        declaration: true,
        declarationMap: true,
        outDir: './dist',
        rootDir: '.',
      },
      include: ['package.json', 'src/**/*.ts', 'src/**/*.tsx'],
      references: [],
    });
  });

  it('preserves the WorkspacePackageManifest dependency matrix for every target package', () => {
    const report = createTemplateValidationReport(packageTemplateTargets.all);

    expect(report.valid).toBe(true);
    expect(report.packages.map((entry) => [entry.packageId, entry.workspaceDependencies])).toEqual([
      ['cli', ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk']],
      ['mcp', ['provider-codex', 'provider-github', 'provider-local', 'provider-markdown', 'sdk']],
      ['provider-codex', ['sdk']],
      ['provider-github', ['sdk']],
      ['provider-local', ['sdk']],
      ['provider-markdown', ['sdk']],
      ['sdk', []],
      ['testkit', ['sdk']],
    ]);
    expect(report.failures).toEqual([]);
  });

  it('places generated package tests in the four configured Vitest lanes', () => {
    const cliTemplate = applyPackageTemplate(packageTemplateTargets.cli);

    expect(cliTemplate.testLanes).toEqual({
      unit: ['packages/cli/tests/cli.unit.test.ts'],
      integration: ['packages/cli/tests/cli.int.test.ts'],
      conformanceMock: ['packages/cli/tests/cli.conformance.test.ts'],
      smokeReal: ['packages/cli/tests/cli.smoke.test.ts'],
    });
  });

  it('reports template-forbidden-import when template content contains forbidden surfaces', () => {
    const report = createTemplateValidationReport([
      {
        ...packageTemplateTargets.sdk,
        description: 'Package template with SECRET placeholder.',
      },
    ]);

    expect(report.valid).toBe(false);
    expect(report.failures).toEqual([
      {
        token: 'template-forbidden-import',
        packageId: 'sdk',
        message: 'Generated file packages/sdk/README.md contains forbidden template content.',
      },
      {
        token: 'template-forbidden-import',
        packageId: 'sdk',
        message: 'Generated file packages/sdk/package.json contains forbidden template content.',
      },
    ]);
  });

  it('marks template validation invalid when export inventory exposes forbidden entrypoints', () => {
    const report = createTemplateValidationReport([
      {
        ...packageTemplateTargets.sdk,
        packageName: 'sdk',
      },
    ]);
    const exportInventoryWithForbiddenExport = {
      ...report.exportInventory,
      exposedForbiddenEntrypoints: [
        {
          packageId: 'sdk',
          publicEntrypoints: ['.'],
          exposedForbiddenEntrypoints: ['./tests'],
          failures: [],
        },
      ],
    };

    expect(report.valid).toBe(true);
    expect(isTemplateValidationReportValid(report.failures, exportInventoryWithForbiddenExport)).toBe(false);
  });
});

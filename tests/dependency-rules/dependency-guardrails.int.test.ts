import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  collectDependencyRuleViolations,
  collectFailureTokens,
  collectRuleNames,
  runDependencyRuleCheck,
  tokenForDependencyRule,
} from '../../tooling/dep-cruiser/dependency-rule-check.js';
import { dependencyRuleFixtures } from './fixtures.js';

describe('epic0-s2-dependency-guardrails', () => {
  it('wires pnpm deps to dependency-cruiser over packages, tooling, and tests', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      readonly scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.deps).toBe('depcruise --config .dependency-cruiser.cjs packages tooling tests');
  });

  it('accepts owner-only external dependencies in their owning packages', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.allowedOwnerOnlyExternalDependencies);

    expect(check).toMatchObject({
      fixtureName: 'allowed-owner-only-external-dependencies',
      valid: true,
      violations: [],
    });
  });

  it('accepts SDK, provider, testkit, and test-only allowed imports', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.allowedProductionAndTestImports);

    expect(check).toMatchObject({
      fixtureName: 'allowed-production-and-test-imports',
      valid: true,
      violations: [],
    });
  });

  it('rejects SDK imports from runtime packages with the named SDK package rule', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.sdkImportsRuntimePackage);

    expect(collectRuleNames(check)).toContain('sdk-must-not-import-runtime-packages');
    expect(collectFailureTokens(check)).toContain('sdk-banned-import');
  });

  it('rejects SDK imports from banned external libraries and child_process', async () => {
    const bannedExternal = await runDependencyRuleCheck(dependencyRuleFixtures.sdkImportsBannedExternal);
    const processHelpers = await runDependencyRuleCheck(dependencyRuleFixtures.sdkImportsBannedProcessHelper);
    const executableRuntime = await runDependencyRuleCheck(dependencyRuleFixtures.sdkImportsBannedExecutableRuntime);
    const childProcess = await runDependencyRuleCheck(dependencyRuleFixtures.sdkImportsChildProcess);

    expect(collectRuleNames(bannedExternal)).toContain('sdk-must-not-import-banned-external-libraries');
    expect(collectRuleNames(processHelpers)).toContain('sdk-must-not-import-banned-external-libraries');
    expect(collectRuleNames(executableRuntime)).toContain('sdk-must-not-import-banned-external-libraries');
    expect(collectRuleNames(childProcess)).toContain('sdk-must-not-import-child-process');
    expect(processHelpers.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleName: 'sdk-must-not-import-banned-external-libraries',
          to: expect.stringContaining('execa'),
        }),
        expect.objectContaining({
          ruleName: 'sdk-must-not-import-banned-external-libraries',
          to: expect.stringContaining('native-containment-helper'),
        }),
      ]),
    );
    expect(executableRuntime.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleName: 'sdk-must-not-import-banned-external-libraries',
          to: expect.stringContaining('@modelcontextprotocol/sdk'),
        }),
        expect.objectContaining({
          ruleName: 'sdk-must-not-import-banned-external-libraries',
          to: expect.stringContaining('commander'),
        }),
      ]),
    );
    expect(collectFailureTokens(bannedExternal)).toContain('sdk-banned-import');
    expect(collectFailureTokens(processHelpers)).toContain('sdk-banned-import');
    expect(collectFailureTokens(executableRuntime)).toContain('sdk-banned-import');
    expect(collectFailureTokens(childProcess)).toContain('sdk-banned-import');
  }, 20_000);

  it('rejects provider peer imports with provider-peer-import evidence', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.providerImportsPeerProvider);

    expect(collectRuleNames(check)).toContain('provider-github-must-not-import-peer-provider');
    expect(collectFailureTokens(check)).toContain('provider-peer-import');
  });

  it('rejects provider production imports from executables and testkit', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.providerProductionImportsExecutableAndTestkit);

    expect(collectRuleNames(check)).toContain('provider-production-must-not-import-executables-or-testkit');
    expect(collectFailureTokens(check)).toContain('dependency-rule-violation');
  });

  it('rejects testkit imports from provider or executable packages', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.testkitImportsProvider);

    expect(collectRuleNames(check)).toContain('testkit-must-import-sdk-only');
    expect(collectFailureTokens(check)).toContain('dependency-rule-violation');
  });

  it('rejects production imports from testkit and fixture helpers', async () => {
    const fixtureImport = await runDependencyRuleCheck(dependencyRuleFixtures.productionImportsTestFixture);
    const conformanceImport = await runDependencyRuleCheck(dependencyRuleFixtures.productionImportsConformanceHelper);

    expect(collectRuleNames(fixtureImport)).toContain('production-must-not-import-testkit-or-fixtures');
    expect(collectRuleNames(conformanceImport)).toContain('production-must-not-import-testkit-or-fixtures');
    expect(collectFailureTokens(fixtureImport)).toContain('production-testkit-import');
    expect(collectFailureTokens(conformanceImport)).toContain('production-testkit-import');
  });

  it('rejects owner-only external dependencies outside their owning packages', async () => {
    const check = await runDependencyRuleCheck(dependencyRuleFixtures.ownerOnlyExternalDependencyViolation);

    expect(collectRuleNames(check)).toEqual(
      expect.arrayContaining([
        'cli-parser-cli-only',
        'execa-local-provider-only',
        'mcp-runtime-mcp-only',
        'octokit-github-provider-only',
      ]),
    );
    expect(check.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleName: 'execa-local-provider-only',
          to: expect.stringContaining('native-containment-helper'),
        }),
        expect.objectContaining({
          ruleName: 'mcp-runtime-mcp-only',
          to: expect.stringContaining('@modelcontextprotocol/sdk'),
        }),
        expect.objectContaining({
          ruleName: 'octokit-github-provider-only',
          to: expect.stringContaining('@octokit/rest'),
        }),
      ]),
    );
    expect(collectFailureTokens(check)).toContain('dependency-rule-violation');
  });

  it('rejects cycles and non-exempt orphan modules', async () => {
    const circular = await runDependencyRuleCheck(dependencyRuleFixtures.circularDependency);
    const orphan = await runDependencyRuleCheck(dependencyRuleFixtures.orphanModule);

    expect(collectRuleNames(circular)).toContain('no-circular');
    expect(collectRuleNames(orphan)).toContain('no-orphans');
    expect(collectFailureTokens(circular)).toContain('graph-hygiene-violation');
    expect(collectFailureTokens(orphan)).toContain('graph-hygiene-violation');
  });

  it('maps dependency-cruiser rule names to S2 failure tokens', () => {
    expect(tokenForDependencyRule('provider-*-must-not-import-peer-provider')).toBe('provider-peer-import');
    expect(tokenForDependencyRule('production-must-not-import-testkit-or-fixtures')).toBe('production-testkit-import');
    expect(tokenForDependencyRule('no-orphans')).toBe('graph-hygiene-violation');
    expect(tokenForDependencyRule('cli-parser-cli-only')).toBe('dependency-rule-violation');
  });

  it('ignores malformed dependency-cruiser violation records', () => {
    expect(collectDependencyRuleViolations({})).toEqual([]);
    expect(collectDependencyRuleViolations({ summary: { violations: [{}] } })).toEqual([]);
  });
});

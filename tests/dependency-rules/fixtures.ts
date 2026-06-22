import type { DependencyRuleFixture } from '../../tooling/dep-cruiser/dependency-rule-check.js';

const moduleFile = (source: string): string => `${source}\n`;

const packageModule = (packageName: string): string =>
  JSON.stringify({
    name: packageName,
    version: '0.0.0',
    type: 'module',
    main: 'index.js',
  });

const externalPackage = (packageName: string, exportName = 'externalValue'): Readonly<Record<string, string>> => ({
  [`node_modules/${packageName}/package.json`]: packageModule(packageName),
  [`node_modules/${packageName}/index.js`]: moduleFile(`export const ${exportName} = '${packageName}';`),
});

export const dependencyRuleFixtures = {
  allowedOwnerOnlyExternalDependencies: {
    name: 'allowed-owner-only-external-dependencies',
    files: {
      ...externalPackage('@octokit/rest', 'Octokit'),
      ...externalPackage('execa', 'execa'),
      ...externalPackage('@modelcontextprotocol/sdk', 'McpServer'),
      ...externalPackage('commander', 'Command'),
      'packages/provider-github/src/index.ts': moduleFile(
        "import { Octokit } from '@octokit/rest';\nexport { Octokit };",
      ),
      'packages/provider-local/src/index.ts': moduleFile("import { execa } from 'execa';\nexport { execa };"),
      'packages/mcp/src/index.ts': moduleFile(
        "import { McpServer } from '@modelcontextprotocol/sdk';\nexport { McpServer };",
      ),
      'packages/cli/src/index.ts': moduleFile("import { Command } from 'commander';\nexport { Command };"),
    },
  },
  allowedProductionAndTestImports: {
    name: 'allowed-production-and-test-imports',
    files: {
      'packages/sdk/src/index.ts': moduleFile("export const sdkValue = 'sdk';"),
      'packages/testkit/src/index.ts': moduleFile(
        "import { sdkValue } from '../../sdk/src/index';\nexport { sdkValue };",
      ),
      'packages/provider-github/src/index.ts': moduleFile(
        "import { sdkValue } from '../../sdk/src/index';\nexport { sdkValue };",
      ),
      'packages/provider-github/src/index.test.ts': moduleFile(
        "import { sdkValue } from '../../sdk/src/index';\nimport { sdkValue as testValue } from '../../testkit/src/index';\nexport const both = [sdkValue, testValue];",
      ),
      'tests/dependency-rules/sample.unit.test.ts': moduleFile(
        "import { sdkValue } from '../../packages/testkit/src/index';\nexport const testValue = sdkValue;",
      ),
    },
  },
  sdkImportsRuntimePackage: {
    name: 'sdk-imports-runtime-package',
    files: {
      'packages/provider-github/src/index.ts': moduleFile("export const providerValue = 'github';"),
      'packages/sdk/src/index.ts': moduleFile(
        "import { providerValue } from '../../provider-github/src/index';\nexport const sdkValue = providerValue;",
      ),
    },
  },
  sdkImportsBannedExternal: {
    name: 'sdk-imports-banned-external',
    files: {
      ...externalPackage('@octokit/rest', 'Octokit'),
      'packages/sdk/src/index.ts': moduleFile("import { Octokit } from '@octokit/rest';\nexport { Octokit };"),
    },
  },
  sdkImportsBannedProcessHelper: {
    name: 'sdk-imports-banned-process-helper',
    files: {
      ...externalPackage('execa', 'execa'),
      ...externalPackage('@kit-vnext/native-containment-helper', 'contain'),
      'packages/sdk/src/index.ts': moduleFile(
        "import { execa } from 'execa';\nimport { contain } from '@kit-vnext/native-containment-helper';\nexport const helpers = [execa, contain];",
      ),
    },
  },
  sdkImportsBannedExecutableRuntime: {
    name: 'sdk-imports-banned-executable-runtime',
    files: {
      ...externalPackage('@modelcontextprotocol/sdk', 'McpServer'),
      ...externalPackage('commander', 'Command'),
      'packages/sdk/src/index.ts': moduleFile(
        "import { McpServer } from '@modelcontextprotocol/sdk';\nimport { Command } from 'commander';\nexport const executableDeps = [McpServer, Command];",
      ),
    },
  },
  sdkImportsChildProcess: {
    name: 'sdk-imports-child-process',
    files: {
      'packages/sdk/src/index.ts': moduleFile("import { spawn } from 'node:child_process';\nexport const run = spawn;"),
    },
  },
  providerImportsPeerProvider: {
    name: 'provider-imports-peer-provider',
    files: {
      'packages/provider-local/src/index.ts': moduleFile("export const localValue = 'local';"),
      'packages/provider-github/src/index.ts': moduleFile(
        "import { localValue } from '../../provider-local/src/index';\nexport const githubValue = localValue;",
      ),
    },
  },
  providerProductionImportsExecutableAndTestkit: {
    name: 'provider-production-imports-executable-and-testkit',
    files: {
      'packages/cli/src/index.ts': moduleFile("export const cliValue = 'cli';"),
      'packages/testkit/src/index.ts': moduleFile("export const testkitValue = 'testkit';"),
      'packages/provider-local/src/index.ts': moduleFile(
        "import { cliValue } from '../../cli/src/index';\nimport { testkitValue } from '../../testkit/src/index';\nexport const localValue = [cliValue, testkitValue];",
      ),
    },
  },
  testkitImportsProvider: {
    name: 'testkit-imports-provider',
    files: {
      'packages/provider-markdown/src/index.ts': moduleFile("export const markdownValue = 'markdown';"),
      'packages/testkit/src/index.ts': moduleFile(
        "import { markdownValue } from '../../provider-markdown/src/index';\nexport const testValue = markdownValue;",
      ),
    },
  },
  productionImportsTestFixture: {
    name: 'production-imports-test-fixture',
    files: {
      'packages/provider-markdown/src/__fixtures__/markdown.ts': moduleFile("export const fixtureValue = 'fixture';"),
      'packages/provider-markdown/src/index.ts': moduleFile(
        "import { fixtureValue } from './__fixtures__/markdown';\nexport const markdownValue = fixtureValue;",
      ),
    },
  },
  productionImportsConformanceHelper: {
    name: 'production-imports-conformance-helper',
    files: {
      'tooling/conformance-helpers/mock-driver.ts': moduleFile("export const conformanceValue = 'conformance';"),
      'packages/provider-markdown/src/index.ts': moduleFile(
        "import { conformanceValue } from '../../../tooling/conformance-helpers/mock-driver';\nexport const markdownValue = conformanceValue;",
      ),
    },
  },
  ownerOnlyExternalDependencyViolation: {
    name: 'owner-only-external-dependency-violation',
    files: {
      ...externalPackage('@octokit/rest', 'Octokit'),
      ...externalPackage('commander', 'Command'),
      ...externalPackage('execa', 'execa'),
      ...externalPackage('@kit-vnext/native-containment-helper', 'contain'),
      ...externalPackage('@modelcontextprotocol/sdk', 'McpServer'),
      'packages/provider-local/src/index.ts': moduleFile(
        "import { Octokit } from '@octokit/rest';\nexport { Octokit };",
      ),
      'packages/provider-github/src/index.ts': moduleFile("import { execa } from 'execa';\nexport { execa };"),
      'packages/provider-markdown/src/index.ts': moduleFile(
        "import { contain } from '@kit-vnext/native-containment-helper';\nexport { contain };",
      ),
      'packages/cli/src/index.ts': moduleFile(
        "import { Command } from 'commander';\nimport { McpServer } from '@modelcontextprotocol/sdk';\nexport const deps = [Command, McpServer];",
      ),
      'packages/mcp/src/index.ts': moduleFile("import { Command } from 'commander';\nexport { Command };"),
    },
  },
  circularDependency: {
    name: 'circular-dependency',
    files: {
      'packages/sdk/src/a.ts': moduleFile("import { b } from './b';\nexport const a = b;"),
      'packages/sdk/src/b.ts': moduleFile("import { a } from './a';\nexport const b = a;"),
    },
  },
  orphanModule: {
    name: 'orphan-module',
    files: {
      'packages/sdk/src/orphan.ts': moduleFile("export const orphan = 'orphan';"),
    },
  },
} satisfies Readonly<Record<string, DependencyRuleFixture>>;

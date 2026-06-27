import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DependencyRuleFailureToken =
  | 'dependency-rule-violation'
  | 'provider-peer-import'
  | 'sdk-banned-import'
  | 'production-testkit-import'
  | 'graph-hygiene-violation';

export type DependencyRuleFixture = {
  readonly name: string;
  readonly files: Readonly<Record<string, string>>;
};

export type DependencyRuleViolation = {
  readonly from: string;
  readonly to: string;
  readonly ruleName: string;
  readonly token: DependencyRuleFailureToken;
};

export type DependencyRuleCheck = {
  readonly fixtureName: string;
  readonly valid: boolean;
  readonly violations: readonly DependencyRuleViolation[];
};

type DepCruiseJson = {
  readonly summary?: {
    readonly violations?: readonly DepCruiseViolation[];
  };
};

type DepCruiseViolation = {
  readonly from?: string;
  readonly to?: string;
  readonly rule?: {
    readonly name?: string;
  };
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const depCruiseBin = join(repositoryRoot, 'node_modules/dependency-cruiser/bin/dependency-cruise.mjs');
const depCruiseConfig = join(repositoryRoot, '.dependency-cruiser.cjs');

const defaultFixtureFiles: Readonly<Record<string, string>> = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2022',
    },
    include: ['packages/**/*.js', 'tooling/**/*.js', 'tests/**/*.js', 'tooling/dep-cruiser/.fixture-root.ts'],
  }),
  'tests/dependency-rules/.fixture-root.js': 'export const dependencyRuleFixtureRoot = true;\n',
  'tooling/dep-cruiser/.fixture-root.js': 'export const depCruiserFixtureRoot = true;\n',
  'tooling/dep-cruiser/.fixture-root.ts': 'export const depCruiserFixtureRootTs = true;\n',
};

export const runDependencyRuleCheck = async (fixture: DependencyRuleFixture): Promise<DependencyRuleCheck> => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'kit-vnext-deps-'));

  try {
    await writeFixtureFiles(fixtureRoot, {
      ...defaultFixtureFiles,
      ...fixture.files,
    });

    const depCruiseOutput = await runDepCruise(fixtureRoot);
    const violations = collectDependencyRuleViolations(depCruiseOutput);

    return {
      fixtureName: fixture.name,
      valid: violations.length === 0,
      violations,
    };
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
};

export const collectRuleNames = (check: DependencyRuleCheck): readonly string[] =>
  [...new Set(check.violations.map((violation) => violation.ruleName))].sort();

export const collectFailureTokens = (check: DependencyRuleCheck): readonly DependencyRuleFailureToken[] =>
  [...new Set(check.violations.map((violation) => violation.token))].sort();

const writeFixtureFiles = async (fixtureRoot: string, files: Readonly<Record<string, string>>): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const absolutePath = join(fixtureRoot, relativePath);

      await writeFileWithParents(absolutePath, contents);
    }),
  );
};

const writeFileWithParents = async (absolutePath: string, contents: string): Promise<void> => {
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
};

const runDepCruise = async (fixtureRoot: string): Promise<DepCruiseJson> => {
  const output = await spawnProcess(
    process.execPath,
    [
      depCruiseBin,
      '--config',
      depCruiseConfig,
      '--output-type',
      'json',
      'packages/**/*.js',
      'tooling/**/*.js',
      'tests/**/*.js',
    ],
    fixtureRoot,
  );

  /* c8 ignore next 3 -- dependency-cruiser should always emit JSON with --output-type json. */
  if (output.stdout.trim().length === 0) {
    throw new Error(`dependency-cruiser produced no JSON output: ${output.stderr}`);
  }

  return JSON.parse(output.stdout) as DepCruiseJson;
};

const spawnProcess = async (
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<{ readonly stdout: string; readonly stderr: string }> =>
  new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', rejectProcess);
    child.on('close', () => {
      resolveProcess({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });

export const collectDependencyRuleViolations = (depCruiseOutput: DepCruiseJson): readonly DependencyRuleViolation[] =>
  (depCruiseOutput.summary?.violations ?? []).flatMap((violation) => {
    const ruleName = violation.rule?.name;

    if (!ruleName) {
      return [];
    }

    return [
      {
        from: violation.from ?? '',
        to: violation.to ?? '',
        ruleName,
        token: tokenForDependencyRule(ruleName),
      },
    ];
  });

export const tokenForDependencyRule = (ruleName: string): DependencyRuleFailureToken => {
  if (ruleName === 'provider-*-must-not-import-peer-provider' || ruleName.includes('must-not-import-peer-provider')) {
    return 'provider-peer-import';
  }

  if (ruleName.startsWith('sdk-must-not-import')) {
    return 'sdk-banned-import';
  }

  if (ruleName === 'production-must-not-import-testkit-or-fixtures') {
    return 'production-testkit-import';
  }

  if (ruleName === 'no-circular' || ruleName === 'no-orphans') {
    return 'graph-hygiene-violation';
  }

  return 'dependency-rule-violation';
};

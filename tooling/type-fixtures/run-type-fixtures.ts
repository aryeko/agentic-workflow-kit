import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compile-fail gate lane (`type:fixtures`).
 *
 * Negative and public type-fixtures encode acceptance criteria of the form
 * "this shape is rejected at compile time" / "this shape is importable". They
 * live as `tsconfig.negative.json` / `tsconfig.public.json` under
 * `packages/**\/tests/**`, but no project in the `tsc -b` build graph references
 * them, and vitest runs with typecheck off — so `pnpm check` never compiles
 * them and the proofs silently rot.
 *
 * This lane closes that gap: it globs each fixture tsconfig and runs a
 * standalone `tsc --noEmit -p <it>`, asserting a non-zero exit for every
 * negative (it must fail to compile) and a zero exit for every public (it must
 * compile clean). Finding zero fixtures is a clean pass, but the checked count
 * is logged so an empty run never reads as "all good" silently.
 */

export type TypeFixtureKind = 'negative' | 'public';

export type TypeFixtureViolationReason = 'negative-fixture-compiled-clean' | 'public-fixture-failed-compile';

export type TypeFixtureViolation = {
  readonly kind: TypeFixtureKind;
  readonly reason: TypeFixtureViolationReason;
  readonly tsconfig: string;
  readonly detail: string;
};

export type TypeFixturesResult = {
  readonly ok: boolean;
  readonly checked: number;
  readonly negativeCount: number;
  readonly publicCount: number;
  readonly violations: readonly TypeFixtureViolation[];
};

export type RunTypeFixturesOptions = {
  readonly packagesRoot?: string;
};

type DiscoveredFixture = {
  readonly kind: TypeFixtureKind;
  readonly tsconfig: string;
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDir, '../..');
const tscBin = join(repositoryRoot, 'node_modules/typescript/bin/tsc');

const NEGATIVE_FILE = 'tsconfig.negative.json';
const PUBLIC_FILE = 'tsconfig.public.json';

export const runTypeFixtures = async (options: RunTypeFixturesOptions = {}): Promise<TypeFixturesResult> => {
  const packagesRoot = options.packagesRoot ?? join(repositoryRoot, 'packages');
  const fixtures = await discoverFixtures(packagesRoot);

  const violations: TypeFixtureViolation[] = [];
  let negativeCount = 0;
  let publicCount = 0;

  for (const fixture of fixtures) {
    if (fixture.kind === 'negative') {
      negativeCount += 1;
    } else {
      publicCount += 1;
    }

    const violation = await checkFixture(fixture);

    if (violation) {
      violations.push(violation);
    }
  }

  return {
    ok: violations.length === 0,
    checked: fixtures.length,
    negativeCount,
    publicCount,
    violations,
  };
};

const discoverFixtures = async (packagesRoot: string): Promise<readonly DiscoveredFixture[]> => {
  const fixtures = await collectTestsFixtures(packagesRoot);

  return [...fixtures].sort((left, right) => left.tsconfig.localeCompare(right.tsconfig));
};

const collectTestsFixtures = async (packagesRoot: string): Promise<readonly DiscoveredFixture[]> => {
  const entries = await safeReaddir(packagesRoot);
  const matches: DiscoveredFixture[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) {
        return;
      }

      const testsDir = join(packagesRoot, entry.name, 'tests');
      matches.push(...(await walkForFixtureTsconfigs(testsDir)));
    }),
  );

  return matches;
};

const walkForFixtureTsconfigs = async (directory: string): Promise<readonly DiscoveredFixture[]> => {
  const entries = await safeReaddir(directory);
  const matches: DiscoveredFixture[] = [];

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        matches.push(...(await walkForFixtureTsconfigs(entryPath)));
        return;
      }

      if (entry.name === NEGATIVE_FILE) {
        matches.push({ kind: 'negative', tsconfig: entryPath });
      } else if (entry.name === PUBLIC_FILE) {
        matches.push({ kind: 'public', tsconfig: entryPath });
      }
    }),
  );

  return matches;
};

const safeReaddir = async (directory: string) => {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }

    throw error;
  }
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';

const checkFixture = async (fixture: DiscoveredFixture): Promise<TypeFixtureViolation | undefined> => {
  const { exitCode, output } = await runTsc(fixture.tsconfig);
  const compiledClean = exitCode === 0;

  if (fixture.kind === 'negative' && compiledClean) {
    return {
      kind: 'negative',
      reason: 'negative-fixture-compiled-clean',
      tsconfig: fixture.tsconfig,
      detail: 'expected at least one TypeScript error, but tsc exited 0',
    };
  }

  if (fixture.kind === 'public' && !compiledClean) {
    return {
      kind: 'public',
      reason: 'public-fixture-failed-compile',
      tsconfig: fixture.tsconfig,
      detail: output.trim() || `tsc exited ${exitCode}`,
    };
  }

  return undefined;
};

const runTsc = async (tsconfig: string): Promise<{ readonly exitCode: number; readonly output: string }> =>
  new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, [tscBin, '--noEmit', '-p', tsconfig], {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', rejectProcess);
    child.on('close', (code) => {
      resolveProcess({ exitCode: code ?? 0, output: Buffer.concat(chunks).toString('utf8') });
    });
  });

export const formatTypeFixturesReport = (result: TypeFixturesResult): string => {
  if (result.checked === 0) {
    return 'type:fixtures — no negative/public fixtures found; nothing to enforce (clean no-op).';
  }

  const summary = `type:fixtures — checked ${result.checked} fixture tsconfig(s) (${result.negativeCount} negative, ${result.publicCount} public).`;

  if (result.ok) {
    return `${summary} All passed.`;
  }

  const lines = result.violations.map((violation) => {
    const where = relative(repositoryRoot, violation.tsconfig);
    return `  - [${violation.kind}] ${where}: ${violation.reason} — ${violation.detail}`;
  });

  return [`${summary} ${result.violations.length} violation(s):`, ...lines].join('\n');
};

export const main = async (options: RunTypeFixturesOptions = {}): Promise<number> => {
  const result = await runTypeFixtures(options);
  process.stdout.write(`${formatTypeFixturesReport(result)}\n`);
  return result.ok ? 0 : 1;
};

const isEntrypoint = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

/* c8 ignore start -- entrypoint wiring is exercised by the gate, not the unit suite. */
if (isEntrypoint) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`type:fixtures lane failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
/* c8 ignore stop */

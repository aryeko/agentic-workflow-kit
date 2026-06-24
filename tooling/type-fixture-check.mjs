import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tsc = path.join(root, 'node_modules', '.bin', 'tsc');

const walk = (dir, matches = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, matches);
      continue;
    }

    if (
      entry.name === 'tsconfig.public.json' ||
      entry.name === 'tsconfig.negative.json' ||
      entry.name === 'tsconfig.json'
    ) {
      matches.push(absolute);
    }
  }

  return matches;
};

const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/');

const relativeFrom = (from, absolute) => path.relative(from, absolute).split(path.sep).join('/');

const escapeRegex = (value) => value.replace(/[.+^${}()|[\]\\]/g, '\\$&');

const readConfig = (configPath) => JSON.parse(fs.readFileSync(configPath, 'utf8'));

const hasFixtureInclude = (configPath) => {
  const config = readConfig(configPath);
  const includes = Array.isArray(config.include) ? config.include : [];

  return includes.some((include) => typeof include === 'string' && /(?:fixture|\.typecheck\.)/.test(include));
};

const isPlainFixtureConfig = (configPath) =>
  path.basename(configPath) === 'tsconfig.json' &&
  relative(configPath).includes('/tests/') &&
  hasFixtureInclude(configPath);

const globToRegex = (pattern) => {
  const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
  const source = normalized
    .split('/')
    .map((segment) => {
      if (segment === '**') {
        return '.*';
      }

      return escapeRegex(segment).replaceAll('*', '[^/]*');
    })
    .join('/');

  return new RegExp(`^${source}$`);
};

const filesUnder = (dir, matches = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      filesUnder(absolute, matches);
      continue;
    }

    matches.push(absolute);
  }

  return matches;
};

const negativeFixturePaths = (configPath) => {
  const configDir = path.dirname(configPath);
  const config = readConfig(configPath);
  const includes = Array.isArray(config.include) ? config.include : [];
  const includeMatchers = includes.map(globToRegex);

  return filesUnder(configDir)
    .filter((fixturePath) => fixturePath.endsWith('.fixture.ts'))
    .filter((fixturePath) => {
      const fixtureRelative = relativeFrom(configDir, fixturePath);
      return includeMatchers.some((matcher) => matcher.test(fixtureRelative));
    })
    .sort((left, right) => left.localeCompare(right));
};

const runTsc = (configPath) =>
  spawnSync(tsc, ['-p', configPath, '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });

const configs = walk(path.join(root, 'packages')).sort((left, right) => left.localeCompare(right));
const positiveConfigs = configs.filter(
  (config) => config.endsWith('tsconfig.public.json') || isPlainFixtureConfig(config),
);
const failures = [];

for (const configPath of positiveConfigs) {
  const result = runTsc(configPath);
  if (result.status !== 0) {
    failures.push(`${relative(configPath)} should compile but failed:\n${result.stdout}${result.stderr}`);
  }
}

for (const configPath of configs.filter((config) => config.endsWith('tsconfig.negative.json'))) {
  const result = runTsc(configPath);
  const output = `${result.stdout}${result.stderr}`;
  const fixturePaths = negativeFixturePaths(configPath);

  if (result.status === 0) {
    failures.push(`${relative(configPath)} should fail but compiled successfully.`);
    continue;
  }

  if (!output.includes('error TS')) {
    failures.push(`${relative(configPath)} failed without TypeScript diagnostics:\n${output}`);
  }

  for (const fixturePath of fixturePaths) {
    const fixtureRelative = relative(fixturePath);
    if (!output.includes(fixtureRelative)) {
      failures.push(`${relative(configPath)} did not report an expected diagnostic for ${fixtureRelative}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}

console.log(`Type fixture check passed (${configs.length} configs).`);

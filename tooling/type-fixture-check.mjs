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

    if (entry.name === 'tsconfig.public.json' || entry.name === 'tsconfig.negative.json') {
      matches.push(absolute);
    }
  }

  return matches;
};

const relative = (absolute) => path.relative(root, absolute).split(path.sep).join('/');

const runTsc = (configPath) =>
  spawnSync(tsc, ['-p', configPath, '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });

const configs = walk(path.join(root, 'packages')).sort((left, right) => left.localeCompare(right));
const failures = [];

for (const configPath of configs.filter((config) => config.endsWith('tsconfig.public.json'))) {
  const result = runTsc(configPath);
  if (result.status !== 0) {
    failures.push(`${relative(configPath)} should compile but failed:\n${result.stdout}${result.stderr}`);
  }
}

for (const configPath of configs.filter((config) => config.endsWith('tsconfig.negative.json'))) {
  const result = runTsc(configPath);
  const output = `${result.stdout}${result.stderr}`;
  const fixtureNames = fs
    .readdirSync(path.dirname(configPath))
    .filter((name) => name.endsWith('.fixture.ts'))
    .sort();

  if (result.status === 0) {
    failures.push(`${relative(configPath)} should fail but compiled successfully.`);
    continue;
  }

  if (!output.includes('error TS')) {
    failures.push(`${relative(configPath)} failed without TypeScript diagnostics:\n${output}`);
  }

  for (const fixtureName of fixtureNames) {
    if (!output.includes(fixtureName)) {
      failures.push(`${relative(configPath)} did not report an expected diagnostic for ${fixtureName}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}

console.log(`Type fixture check passed (${configs.length} configs).`);

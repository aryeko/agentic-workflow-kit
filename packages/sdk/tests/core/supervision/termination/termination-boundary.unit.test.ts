import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const terminationRoot = fileURLToPath(new URL('../../../../src/core/supervision/termination/', import.meta.url));
const forbiddenPattern = /child_process|process\.kill|provider-local|execa/;

const collectFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = `${directory}${directory.endsWith('/') ? '' : '/'}${entry}`;
    const stats = statSync(path);
    return stats.isDirectory() ? collectFiles(path) : [path];
  });

describe('core-04-s4 termination boundary', () => {
  it('keeps the termination surface free of process APIs and concrete provider helpers', () => {
    const matches = collectFiles(terminationRoot).flatMap((path) => {
      const contents = readFileSync(path, 'utf8');
      return forbiddenPattern.test(contents) ? [path] : [];
    });

    expect(matches).toEqual([]);
  });
});

const escapeForRegex = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const globToRegExp = (pattern: string): RegExp => {
  let regex = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const current = pattern[index];
    const next = pattern[index + 1];

    if (current === '*' && next === '*') {
      regex += '.*';
      index += 1;
      continue;
    }

    if (current === '*') {
      regex += '[^/]*';
      continue;
    }

    if (current === '?') {
      regex += '[^/]';
      continue;
    }

    regex += escapeForRegex(current);
  }

  return new RegExp(`${regex}$`);
};

export const matchesAnyPathPattern = (path: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => globToRegExp(pattern).test(path));

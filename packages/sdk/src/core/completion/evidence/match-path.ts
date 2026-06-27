const escapeForRegex = (value: string): string => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const compiledPatternCache = new Map<string, RegExp>();
const DOUBLESTAR_SLASH_TOKEN = '\u0000DOUBLESTAR_SLASH\u0000';
const SLASH_DOUBLESTAR_TOKEN = '\u0000SLASH_DOUBLESTAR\u0000';
const DOUBLESTAR_TOKEN = '\u0000DOUBLESTAR\u0000';
const STAR_TOKEN = '\u0000STAR\u0000';
const QUESTION_TOKEN = '\u0000QUESTION\u0000';

const globToRegExp = (pattern: string): RegExp => {
  const cached = compiledPatternCache.get(pattern);
  if (cached !== undefined) {
    return cached;
  }

  let regex = pattern;
  regex = regex.replace(/\*\*\//g, DOUBLESTAR_SLASH_TOKEN);
  regex = regex.replace(/\/\*\*/g, SLASH_DOUBLESTAR_TOKEN);
  regex = regex.replace(/\*\*/g, DOUBLESTAR_TOKEN);
  regex = regex.replace(/\*/g, STAR_TOKEN);
  regex = regex.replace(/\?/g, QUESTION_TOKEN);
  regex = escapeForRegex(regex);
  regex = regex.replaceAll(DOUBLESTAR_SLASH_TOKEN, '(?:[^/]+/)*');
  regex = regex.replaceAll(SLASH_DOUBLESTAR_TOKEN, '(?:/[^/]+)*');
  regex = regex.replaceAll(DOUBLESTAR_TOKEN, '.*');
  regex = regex.replaceAll(STAR_TOKEN, '[^/]*');
  regex = regex.replaceAll(QUESTION_TOKEN, '[^/]');

  const compiled = new RegExp(`^${regex}$`);
  compiledPatternCache.set(pattern, compiled);
  return compiled;
};

export const matchesAnyPathPattern = (path: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => globToRegExp(pattern).test(path));

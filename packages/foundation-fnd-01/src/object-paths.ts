const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const leafPaths = (value: unknown, prefix = ''): readonly string[] => {
  if (!isPlainObject(value)) {
    return prefix ? [prefix] : [];
  }

  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
  if (entries.length === 0) {
    return prefix ? [prefix] : [];
  }

  return entries.flatMap(([key, entry]) => leafPaths(entry, prefix ? `${prefix}.${key}` : key));
};

export const hasPath = (value: unknown, path: string): boolean => {
  const segments = path.split('.');
  let current = value;
  for (const segment of segments) {
    if (!isPlainObject(current) || !Object.hasOwn(current, segment)) {
      return false;
    }
    current = current[segment];
  }
  return current !== undefined;
};

export const getPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, segment) => {
    if (isPlainObject(current) && Object.hasOwn(current, segment)) {
      return current[segment];
    }
    return undefined;
  }, value);

export const setPath = (value: unknown, path: string, leafValue: unknown): unknown => {
  const [head, ...tail] = path.split('.');
  if (!head) {
    return leafValue;
  }

  const current = isPlainObject(value) ? value : {};
  return {
    ...current,
    [head]: tail.length === 0 ? leafValue : setPath(current[head], tail.join('.'), leafValue),
  };
};

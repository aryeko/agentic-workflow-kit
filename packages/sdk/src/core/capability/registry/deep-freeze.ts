const isFreezableRecord = (value: unknown): value is Record<string, unknown> | readonly unknown[] =>
  typeof value === 'object' && value !== null;

export const deepFreeze = <T>(value: T): T => {
  if (!isFreezableRecord(value) || Object.isFrozen(value)) {
    return value;
  }

  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }

  return Object.freeze(value);
};

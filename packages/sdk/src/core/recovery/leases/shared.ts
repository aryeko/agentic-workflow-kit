export const assertSourceEventIds = (sourceEventIds: readonly string[], label: string): void => {
  if (sourceEventIds.length === 0) {
    throw new TypeError(`${label} requires at least one source event id.`);
  }
};

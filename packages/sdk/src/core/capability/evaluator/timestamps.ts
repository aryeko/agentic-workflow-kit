export const toEpochMs = (timestamp: string): number | undefined => {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : undefined;
};

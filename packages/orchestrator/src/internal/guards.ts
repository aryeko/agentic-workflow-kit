export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value;
}

export function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

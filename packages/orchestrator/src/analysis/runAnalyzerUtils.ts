import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { defaultSessionLogRoots } from '../drivers/sessionLogs.js';
import { isNodeError, isRecord } from '../internal/guards.js';
import type { NormalizedEvent } from './runAnalyzerTypes.js';

export async function findSessionLogs(roots: string[]): Promise<string[]> {
  const logs: string[] = [];
  for (const root of roots) {
    if (!(await pathExists(root))) continue;
    await walkJsonl(root, logs);
  }
  return logs;
}

export async function readEvents(filePath: string): Promise<NormalizedEvent[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }

  return content
    .split('\n')
    .map((line, index) => ({ entry: parseJsonLine(line), index }))
    .filter((item): item is { entry: Record<string, unknown>; index: number } => item.entry !== null)
    .map(({ entry, index }) => normalizeEvent(entry, index))
    .filter((event): event is NormalizedEvent => event !== null);
}

function normalizeEvent(entry: Record<string, unknown>, index: number): NormalizedEvent | null {
  const type = readOptionalString(entry.type) ?? readOptionalString(entry.event);
  if (!type) return null;
  const eventAt =
    readOptionalString(entry.eventAt) ??
    readOptionalString(entry.ts) ??
    readOptionalString(entry.time) ??
    readOptionalString(entry.recordedAt);
  const recordedAt =
    readOptionalString(entry.recordedAt) ?? readOptionalString(entry.ts) ?? readOptionalString(entry.time) ?? eventAt;
  return { type, eventAt, recordedAt, index, raw: entry };
}

export async function walkJsonl(directory: string, logs: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walkJsonl(entryPath, logs);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      logs.push(entryPath);
    }
  }
}

export function defaultSessionRoots(): string[] {
  return defaultSessionLogRoots();
}

export async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) throw new Error(`${filePath} must contain a JSON object`);
  return parsed;
}

export async function readJsonObjectIfExists(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return await readJsonObject(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function pathMtime(filePath: string): Promise<string | null> {
  try {
    return (await stat(filePath)).mtime.toISOString();
  } catch {
    return null;
  }
}

export function parseJsonLine(line: string): Record<string, unknown> | null {
  if (line.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  return value;
}

export function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => isRecord(entry));
}

export function readStringRecord(value: unknown): Record<string, string> {
  const record = readRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export function readOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

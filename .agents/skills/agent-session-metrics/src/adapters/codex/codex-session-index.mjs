import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { MetricsError } from '../../contracts.mjs';
import { summarizeCodexSession } from './codex-session-summary.mjs';

export async function discoverCodexSessionRecords({ providerHome }) {
  const roots = [join(providerHome, 'sessions'), join(providerHome, 'archived_sessions')];
  const files = (await Promise.all(roots.map((root) => listJsonlFiles(root)))).flat().sort();
  const records = [];

  for (const recordPath of files) {
    const summary = await summarizeCodexSession({ recordPath });
    const fileStat = await stat(recordPath);
    records.push({
      sessionId: summary.sessionId,
      parentSessionId: summary.parentSessionId,
      recordPath,
      summary,
      mtimeMs: fileStat.mtimeMs,
    });
  }

  return records;
}

export async function resolveCodexTarget({ target, providerHome }) {
  if (target.kind === 'session-file') {
    const recordPath = resolve(target.sessionFile);
    const summary = await summarizeCodexSession({ recordPath });
    return {
      resolution: 'session-file',
      sessionId: summary.sessionId,
      recordPath,
      confidence: 'exact',
      summary,
    };
  }

  if (target.kind !== 'session-id') {
    throw new MetricsError(`Unsupported target kind for codex: ${target.kind}`);
  }

  const records = await discoverCodexSessionRecords({ providerHome });
  const matches = records.filter((record) => sessionIdMatches(record, target.sessionId));
  if (matches.length === 0) {
    throw new MetricsError(`Could not resolve session id: ${target.sessionId}`, { code: 2 });
  }

  const parsedIds = new Set(matches.map((match) => match.sessionId));
  if (parsedIds.size > 1) {
    throw new MetricsError(`Ambiguous session-id resolution for ${target.sessionId}`, { code: 2 });
  }

  const newest = [...matches].sort(
    (left, right) => right.mtimeMs - left.mtimeMs || left.recordPath.localeCompare(right.recordPath),
  )[0];
  return {
    resolution: 'session-id',
    sessionId: newest.sessionId,
    recordPath: newest.recordPath,
    confidence: 'exact',
    summary: newest.summary,
  };
}

async function listJsonlFiles(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return listJsonlFiles(path);
      }
      return entry.isFile() && entry.name.endsWith('.jsonl') ? [path] : [];
    }),
  );
  return nested.flat();
}

function sessionIdMatches(record, sessionId) {
  if (record.sessionId === sessionId) {
    return true;
  }
  const stem = basename(record.recordPath).replace(/\.jsonl$/u, '');
  return stem.endsWith(sessionId) || stem.includes(sessionId);
}

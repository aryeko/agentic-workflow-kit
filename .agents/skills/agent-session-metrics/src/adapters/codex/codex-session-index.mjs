import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { MetricsError } from '../../contracts.mjs';
import { codexSessionDataTypes, extractCodexSessionData } from './codex-session-extractor.mjs';
import { findCodexSessionCandidatePaths, listCodexJsonlPaths } from './codex-session-paths.mjs';
import { summarizeCodexSession } from './codex-session-summary.mjs';

export async function discoverCodexSessionRecords({ providerHome }) {
  const files = await listCodexJsonlPaths({ providerHome });
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

export async function extractCodexSessions({ target, providerHome, scope }) {
  const resolvedTarget = await resolveCodexTarget({ target, providerHome });
  const rootTypes =
    scope === 'main'
      ? [codexSessionDataTypes.sessionMeta, codexSessionDataTypes.metrics]
      : [codexSessionDataTypes.sessionMeta, codexSessionDataTypes.spawnedSessions, codexSessionDataTypes.metrics];
  const rootSummary = await extractCodexSessionData({
    recordPath: resolvedTarget.recordPath,
    dataTypes: rootTypes,
  });
  const targetWithSummary = {
    ...resolvedTarget,
    sessionId: rootSummary.sessionId,
    summary: rootSummary,
  };

  if (scope === 'main') {
    return {
      target: targetWithSummary,
      sessions: [rootSummary],
    };
  }

  const descendants = await extractSpawnedDescendants({
    providerHome,
    parentSummary: rootSummary,
    visitedSessionIds: new Set([rootSummary.sessionId]),
  });
  return {
    target: targetWithSummary,
    sessions: [rootSummary, ...descendants],
  };
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

  const records = await resolveCodexSessionCandidates({ providerHome, sessionId: target.sessionId });
  const exactMatches = records.filter((record) => record.sessionId === target.sessionId);
  const matches =
    exactMatches.length > 0 ? exactMatches : records.filter((record) => sessionIdMatches(record, target.sessionId));
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

async function extractSpawnedDescendants({ providerHome, parentSummary, visitedSessionIds }) {
  const descendants = [];
  for (const childSessionId of parentSummary.spawnedSessionIds ?? []) {
    if (visitedSessionIds.has(childSessionId)) {
      continue;
    }
    const resolvedChild = await resolveCodexTarget({
      target: { kind: 'session-id', sessionId: childSessionId },
      providerHome,
    });
    const childSummary = await extractCodexSessionData({
      recordPath: resolvedChild.recordPath,
      dataTypes: [
        codexSessionDataTypes.sessionMeta,
        codexSessionDataTypes.spawnedSessions,
        codexSessionDataTypes.metrics,
      ],
    });
    visitedSessionIds.add(childSummary.sessionId);
    descendants.push(childSummary);
    descendants.push(
      ...(await extractSpawnedDescendants({
        providerHome,
        parentSummary: childSummary,
        visitedSessionIds,
      })),
    );
  }
  return descendants;
}

async function resolveCodexSessionCandidates({ providerHome, sessionId }) {
  const files = await findCodexSessionCandidatePaths({ providerHome, sessionId });
  const records = [];
  for (const recordPath of files) {
    const summary = await extractCodexSessionData({
      recordPath,
      dataTypes: [codexSessionDataTypes.sessionMeta],
    });
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

function sessionIdMatches(record, sessionId) {
  if (record.sessionId === sessionId) {
    return true;
  }
  const stem = basename(record.recordPath).replace(/\.jsonl$/u, '');
  return stem.endsWith(sessionId) || stem.includes(sessionId);
}

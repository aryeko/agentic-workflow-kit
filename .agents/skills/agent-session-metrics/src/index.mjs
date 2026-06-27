import { getProviderAdapter } from './adapter-registry.mjs';
import { aggregateSessions } from './aggregate.mjs';
import { normalizeScope, normalizeTarget } from './contracts.mjs';
import { buildSessionResponse } from './session-response.mjs';
import { buildSessionTree, selectSessionsByScope } from './session-tree.mjs';

export async function analyzeAgentSessionMetrics(options = {}) {
  const provider = options.provider ?? 'codex';
  const scope = normalizeScope(options.scope ?? 'tree');
  const target = normalizeTarget(options.target);
  const adapter = getProviderAdapter(provider);
  const providerHome = await adapter.resolveHome({ providerHome: options.providerHome });
  const extracted = adapter.extractSessions
    ? await adapter.extractSessions({ target, providerHome, scope })
    : await extractSessionsByDiscovery({ adapter, target, providerHome });
  const resolvedTarget = extracted.target;
  const summaries = extracted.sessions;
  const tree = buildSessionTree({ rootSessionId: resolvedTarget.sessionId, sessions: summaries });
  const selectedSessions = selectSessionsByScope({ sessions: summaries, tree, scope });
  const aggregate = aggregateSessions(selectedSessions);
  const warnings = collectWarnings({ sessions: selectedSessions, treeWarnings: tree.warnings });
  const main = buildSessionResponse({
    rootSessionId: tree.rootSessionId,
    sessions: summaries,
    tree,
    scope,
  });

  return {
    status: 'ok',
    main,
    provider,
    target: {
      resolution: resolvedTarget.resolution,
      sessionId: resolvedTarget.sessionId,
      recordPath: resolvedTarget.recordPath,
      confidence: resolvedTarget.confidence,
    },
    scope,
    providerHome,
    root: resolvedTarget.summary,
    sessions: selectedSessions,
    tree: {
      rootSessionId: tree.rootSessionId,
      nodes: tree.nodes,
    },
    aggregate,
    warnings,
  };
}

async function extractSessionsByDiscovery({ adapter, target, providerHome }) {
  const resolvedTarget = await adapter.resolveTarget({ target, providerHome });
  const allSummaries =
    target.kind === 'session-file'
      ? [resolvedTarget.summary]
      : (await adapter.discoverSessions({ providerHome })).map((record) => record.summary);
  return {
    target: resolvedTarget,
    sessions: mergeTargetSummary({ summaries: allSummaries, targetSummary: resolvedTarget.summary }),
  };
}

function mergeTargetSummary({ summaries, targetSummary }) {
  const withoutTarget = summaries.filter((summary) => summary.sessionId !== targetSummary.sessionId);
  return [targetSummary, ...withoutTarget];
}

function collectWarnings({ sessions, treeWarnings }) {
  return [
    ...new Set([
      ...sessions.flatMap((session) => session.warnings.map((warning) => `${session.sessionId}: ${warning}`)),
      ...treeWarnings,
    ]),
  ];
}

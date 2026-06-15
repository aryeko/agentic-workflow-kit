import type { ChildMetricsSnapshot, LiveMetricsSnapshot, TokenTotals } from '../types.js';

export function mergeChildMetrics(children: ChildMetricsSnapshot[]): LiveMetricsSnapshot['aggregate'] {
  const toolCounts: Record<string, number> = {};
  const subagentCounts: Record<string, number> = {};
  let failedToolCalls = 0;
  let sawFailedToolCalls = false;
  let tokenTotals = emptyTokenTotals();
  let sawTokens = false;

  for (const child of children) {
    mergeCounts(toolCounts, child.toolCounts);
    mergeCounts(subagentCounts, child.subagentCounts);
    if (typeof child.failedToolCalls === 'number') {
      sawFailedToolCalls = true;
      failedToolCalls += child.failedToolCalls;
    }
    if (child.tokenTotals) {
      sawTokens = true;
      tokenTotals = addTokenTotals(tokenTotals, child.tokenTotals);
    }
  }

  return {
    toolCounts,
    failedToolCalls: sawFailedToolCalls ? failedToolCalls : null,
    subagentCounts,
    tokenTotals: sawTokens ? tokenTotals : null,
  };
}

export function addTokenTotals(a: TokenTotals, b: TokenTotals): TokenTotals {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    reasoningOutputTokens: a.reasoningOutputTokens + b.reasoningOutputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export function mergeCounts(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

export function emptyTokenTotals(): TokenTotals {
  return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 };
}

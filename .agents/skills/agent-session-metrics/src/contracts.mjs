export class MetricsError extends Error {
  constructor(message, { code = 1 } = {}) {
    super(message);
    this.name = 'MetricsError';
    this.code = code;
  }
}

export const supportedScopes = new Set(['tree', 'main', 'children']);
export const supportedFormats = new Set(['json', 'markdown']);

export function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MetricsError(`${label} must be an object`);
  }
}

export function normalizeScope(scope = 'tree') {
  if (!supportedScopes.has(scope)) {
    throw new MetricsError(`Unsupported scope: ${scope}`);
  }
  return scope;
}

export function normalizeTarget(target) {
  assertObject(target, 'target');
  if (target.kind === 'session-id' && typeof target.sessionId === 'string' && target.sessionId) {
    return { kind: 'session-id', sessionId: target.sessionId };
  }
  if (target.kind === 'session-file' && typeof target.sessionFile === 'string' && target.sessionFile) {
    return { kind: 'session-file', sessionFile: target.sessionFile };
  }
  if (target.kind === 'current') {
    throw new MetricsError('Current-session heuristics are not implemented by this package');
  }
  throw new MetricsError('target must be session-id or session-file');
}

export function unavailableTokenUsage() {
  return {
    status: 'unavailable',
    source: 'unavailable',
    total: null,
    last: null,
    modelContextWindow: null,
  };
}

export function zeroTokenBreakdown() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
  };
}

export function addTokenBreakdown(left, right) {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    reasoningOutputTokens: left.reasoningOutputTokens + right.reasoningOutputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

export function normalizeTokenBreakdown(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const inputTokens = numeric(value.inputTokens ?? value.input_tokens);
  const cachedInputTokens = numeric(value.cachedInputTokens ?? value.cached_input_tokens);
  const outputTokens = numeric(value.outputTokens ?? value.output_tokens);
  const reasoningOutputTokens = numeric(value.reasoningOutputTokens ?? value.reasoning_output_tokens);
  const explicitTotal = numeric(value.totalTokens ?? value.total_tokens);
  const totalTokens = explicitTotal ?? sumKnown([inputTokens, outputTokens]);

  if (
    [inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens, totalTokens].every((item) => item === null)
  ) {
    return null;
  }

  return {
    inputTokens: inputTokens ?? 0,
    cachedInputTokens: cachedInputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    reasoningOutputTokens: reasoningOutputTokens ?? 0,
    totalTokens: totalTokens ?? 0,
  };
}

export function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sumKnown(values) {
  if (values.every((value) => value === null)) {
    return null;
  }
  return values.reduce((sum, value) => sum + (value ?? 0), 0);
}

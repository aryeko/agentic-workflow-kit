import type {
  AgentBudgetPolicy,
  BudgetArtifact,
  BudgetEvaluation,
  LiveMetricsSnapshot,
  ResolvedAgentProfile,
  ResolvedWorkflowConfig,
} from '../types.js';
import { UNAVAILABLE_REASONS } from './availability.js';

type BudgetDimension = keyof AgentBudgetPolicy;

export function buildBudgetArtifact(
  runId: string,
  config: ResolvedWorkflowConfig,
  metrics: LiveMetricsSnapshot,
): BudgetArtifact {
  const profiles = Object.fromEntries(
    Object.values(config.agents.resolved).map((profile) => [
      `${profile.taskType}:${profile.name}`,
      {
        taskType: profile.taskType,
        profileName: profile.name,
        budget: profile.budget,
        support: profile.budgetSupport,
      },
    ]),
  );
  return {
    schemaVersion: 1,
    runId,
    profiles,
    evaluations: Object.values(config.agents.resolved).flatMap((profile) => evaluateProfileBudget(profile, metrics)),
  };
}

function evaluateProfileBudget(profile: ResolvedAgentProfile, metrics: LiveMetricsSnapshot): BudgetEvaluation[] {
  return (Object.keys(profile.budget) as BudgetDimension[]).map((dimension) => {
    const policy = profile.budget[dimension];
    const observed = observedBudgetValue(dimension, metrics);
    const unavailableReason = observed.unavailableReason ?? profile.budgetSupport[dimension].unavailableReason;
    const status = budgetStatus(policy.limit, policy.warnAtPercent, observed.value, unavailableReason);
    return {
      profileName: profile.name,
      taskType: profile.taskType,
      dimension,
      limit: policy.limit,
      observed: observed.value,
      warnAtPercent: policy.warnAtPercent,
      action: policy.action,
      status,
      unavailableReason: status === 'unavailable' ? (unavailableReason ?? 'budget telemetry is unavailable') : null,
      eventType: budgetEventType(status, policy.action),
    };
  });
}

function observedBudgetValue(
  dimension: BudgetDimension,
  metrics: LiveMetricsSnapshot,
): { value: number | null; unavailableReason: string | null } {
  switch (dimension) {
    case 'wallMs':
      return { value: metrics.elapsedMs, unavailableReason: null };
    case 'toolCalls':
      return countBudgetMetric(metrics, 'toolCounts', UNAVAILABLE_REASONS.sessionLogMetrics);
    case 'failedToolCalls':
      return countFailedToolCalls(metrics);
    case 'tokens':
      return metrics.aggregate.tokenTotals
        ? { value: metrics.aggregate.tokenTotals.totalTokens, unavailableReason: null }
        : { value: null, unavailableReason: UNAVAILABLE_REASONS.tokenTelemetry };
  }
}

function countFailedToolCalls(metrics: LiveMetricsSnapshot): {
  value: number | null;
  unavailableReason: string | null;
} {
  const children = Object.values(metrics.children);
  if (children.length === 0) return { value: null, unavailableReason: UNAVAILABLE_REASONS.failedToolCalls };
  const hasUnavailableChild = children.some((child) => child.availability?.failedToolCalls?.status !== 'available');
  if (hasUnavailableChild) return { value: null, unavailableReason: UNAVAILABLE_REASONS.failedToolCalls };
  return { value: metrics.aggregate.failedToolCalls ?? 0, unavailableReason: null };
}

function budgetStatus(
  limit: number | null,
  warnAtPercent: number | null,
  observed: number | null,
  unavailableReason: string | null | undefined,
): BudgetEvaluation['status'] {
  if (observed === null && unavailableReason) return 'unavailable';
  if (limit === null) return 'not-configured';
  if (observed === null) return 'not-configured';
  if (observed >= limit) return 'limit-reached';
  if (warnAtPercent !== null && observed >= limit * (warnAtPercent / 100)) return 'warning';
  return 'within-limit';
}

function budgetEventType(
  status: BudgetEvaluation['status'],
  action: BudgetEvaluation['action'],
): BudgetEvaluation['eventType'] {
  if (status === 'warning') return 'budget-warning';
  if (status !== 'limit-reached') return null;
  return action === 'warn' ? 'budget-warning' : 'budget-stop';
}

function countBudgetMetric(
  metrics: LiveMetricsSnapshot,
  dimension: 'toolCounts' | 'subagentCounts',
  unavailableReason: string,
): { value: number | null; unavailableReason: string | null } {
  const counts = metrics.aggregate[dimension];
  const values = Object.values(counts);
  const hasObservedChild = Object.values(metrics.children).some(
    (child) => child.availability?.[dimension]?.status === 'available',
  );
  if (values.length === 0 && hasObservedChild) return { value: 0, unavailableReason: null };
  if (values.length === 0) return { value: null, unavailableReason };
  return { value: values.reduce((sum, count) => sum + count, 0), unavailableReason: null };
}

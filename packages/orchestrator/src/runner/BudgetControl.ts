import type { AgentBudgetAction, BudgetEvaluation } from '../types.js';

export type BudgetControlAction = 'continue' | AgentBudgetAction;

export interface BudgetControlDecision {
  action: BudgetControlAction;
  evaluation: BudgetEvaluation | null;
  reason: string | null;
  stopNewLaunches: boolean;
  checkpointStop: boolean;
  abort: boolean;
}

const CONTINUE: BudgetControlDecision = {
  action: 'continue',
  evaluation: null,
  reason: null,
  stopNewLaunches: false,
  checkpointStop: false,
  abort: false,
};

const ACTION_RANK: Record<BudgetControlAction, number> = {
  continue: 0,
  warn: 1,
  'stop-new-launches': 2,
  'checkpoint-stop': 3,
  abort: 4,
};

export function selectBudgetControlDecision(evaluations: BudgetEvaluation[]): BudgetControlDecision {
  const overLimit = evaluations.filter((evaluation) => evaluation.status === 'limit-reached');
  const strongest = overLimit.reduce<BudgetEvaluation | null>((selected, evaluation) => {
    if (!selected) return evaluation;
    return ACTION_RANK[evaluation.action] > ACTION_RANK[selected.action] ? evaluation : selected;
  }, null);
  if (!strongest) {
    const warning = evaluations.find((evaluation) => evaluation.status === 'warning') ?? null;
    return warning
      ? { ...CONTINUE, action: 'warn', evaluation: warning, reason: budgetControlReason(warning) }
      : CONTINUE;
  }
  const action = strongest.action;
  return {
    action,
    evaluation: strongest,
    reason: budgetControlReason(strongest),
    stopNewLaunches: action === 'stop-new-launches' || action === 'checkpoint-stop' || action === 'abort',
    checkpointStop: action === 'checkpoint-stop' || action === 'abort',
    abort: action === 'abort',
  };
}

export function isStrongerBudgetControl(next: BudgetControlDecision, current: BudgetControlDecision | null): boolean {
  return ACTION_RANK[next.action] > ACTION_RANK[current?.action ?? 'continue'];
}

function budgetControlReason(evaluation: BudgetEvaluation): string {
  return [
    `budget ${evaluation.action}`,
    `${evaluation.taskType}:${evaluation.profileName}`,
    evaluation.dimension,
    evaluation.status,
    `observed=${evaluation.observed ?? 'unavailable'}`,
    `limit=${evaluation.limit ?? 'none'}`,
    'see budgets.json',
  ].join(' ');
}

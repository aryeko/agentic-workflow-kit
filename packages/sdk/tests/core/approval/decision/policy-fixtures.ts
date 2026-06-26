import type { PolicyGrantScope, ResolvedPolicy } from 'sdk';

import { createPolicy } from './fixtures.js';

export const createRuleOnlyPolicy = (
  scope: 'per-command' | 'per-command-prefix',
  allowedGrantScopes: readonly PolicyGrantScope[] = [scope],
): ResolvedPolicy => {
  const basePolicy = createPolicy();
  return createPolicy({
    policy: {
      ...basePolicy.policy,
      escalationPolicy: {
        ...basePolicy.policy.escalationPolicy,
        allowedGrantScopes,
        maxGrantScope: allowedGrantScopes.at(-1) ?? scope,
        grantRules: [
          {
            reason: 'verification',
            scope,
            prefixes: scope === 'per-command' ? ['pnpm check'] : ['pnpm '],
            requiresOperator: false,
          },
        ],
      },
    },
  });
};

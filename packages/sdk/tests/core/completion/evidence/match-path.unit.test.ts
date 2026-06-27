import { describe, expect, it } from 'vitest';

import { classifyChangedPaths } from '../../../../src/core/completion/evidence/index.js';
import { matchesAnyPathPattern } from '../../../../src/core/completion/evidence/match-path.js';

describe('core-05-s2 path glob matching', () => {
  it('allows zero-segment doublestar matches at the root and inside path prefixes', () => {
    expect(matchesAnyPathPattern('policy.yaml', ['**/policy.yaml'])).toBe(true);
    expect(matchesAnyPathPattern('nested/policy.yaml', ['**/policy.yaml'])).toBe(true);
    expect(matchesAnyPathPattern('config/secrets.yaml', ['config/**/secrets.yaml'])).toBe(true);
    expect(matchesAnyPathPattern('config/env/prod/secrets.yaml', ['config/**/secrets.yaml'])).toBe(true);
  });

  it('keeps protected-path precedence when zero-segment doublestar matches the same path as the allowlist', () => {
    const classification = classifyChangedPaths({
      changedPaths: ['config/secrets.yaml'],
      allowedChangePaths: ['config/**'],
      protectedPathSets: [{ label: 'secrets', digest: 'sha256:secrets', paths: ['config/**/secrets.yaml'] }],
      runnerEvidencePaths: ['.codex/agentic-workflow-kit/runs/**'],
      protectedPolicyApproved: false,
    });

    expect(classification.classifications).toEqual([{ path: 'config/secrets.yaml', class: 'protected-policy-change' }]);
    expect(classification.state).toBe('protected-policy-change-unapproved');
  });
});

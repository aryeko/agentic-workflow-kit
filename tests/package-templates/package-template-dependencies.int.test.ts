import { describe, expect, it } from 'vitest';
import { runDependencyRuleCheck } from '../../tooling/dep-cruiser/dependency-rule-check.js';
import { applyPackageTemplate, packageTemplateTargets } from '../../tooling/package-templates/package-template.js';

describe('package template dependency evidence', () => {
  it('creates no forbidden import or dependency edge for target packages', async () => {
    const files = Object.fromEntries(
      packageTemplateTargets.all.flatMap((target) => Object.entries(applyPackageTemplate(target).files)),
    );

    const check = await runDependencyRuleCheck({
      name: 'package-template-generated-targets',
      files,
    });

    expect(check).toEqual({
      fixtureName: 'package-template-generated-targets',
      valid: true,
      violations: [],
    });
  });
});

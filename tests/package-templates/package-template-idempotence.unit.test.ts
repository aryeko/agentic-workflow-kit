import { describe, expect, it } from 'vitest';
import {
  applyPackageTemplate,
  diffTemplateApplications,
  packageTemplateTargets,
} from '../../tooling/package-templates/package-template.js';

describe('package template determinism', () => {
  it('reapplies deterministically without file churn', () => {
    const first = applyPackageTemplate(packageTemplateTargets.providerGithub);
    const second = applyPackageTemplate(packageTemplateTargets.providerGithub);

    expect(diffTemplateApplications(first, second)).toEqual({
      token: 'template-drift',
      changedPaths: [],
    });
    expect(second).toEqual(first);
  });

  it('reports template-drift with changed paths when generated content changes', () => {
    const first = applyPackageTemplate(packageTemplateTargets.testkit);
    const changed = {
      ...first,
      files: {
        ...first.files,
        'packages/testkit/src/index.ts': `${first.files['packages/testkit/src/index.ts']}\nexport const drift = true;\n`,
      },
    };

    expect(diffTemplateApplications(first, changed)).toEqual({
      token: 'template-drift',
      changedPaths: ['packages/testkit/src/index.ts'],
    });
  });
});

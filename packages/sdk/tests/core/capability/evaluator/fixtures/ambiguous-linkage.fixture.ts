import { createAllowAutoMergeScenario, createProjections } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const ambiguousLinkageFixture = {
  ...base,
  projections: createProjections({
    ...base.projections,
    launch: {
      ...base.projections.launch,
      linkage: 'ambiguous',
    },
  }),
};

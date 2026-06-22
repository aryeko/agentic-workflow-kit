export type PolicyShapeExposure = 'desired-powers' | 'policy-source-data';

export type PolicyShapeDescriptor = {
  readonly exposure: PolicyShapeExposure;
  readonly fields: readonly string[];
};

export type ConsumerPolicyShapes = {
  readonly run: PolicyShapeDescriptor;
  readonly provisioning: PolicyShapeDescriptor;
  readonly approval: PolicyShapeDescriptor;
  readonly escalationPolicy: PolicyShapeDescriptor;
  readonly changePolicy: PolicyShapeDescriptor;
  readonly capabilities: PolicyShapeDescriptor;
  readonly credentialRefs: PolicyShapeDescriptor;
  readonly egress: PolicyShapeDescriptor;
  readonly merge: PolicyShapeDescriptor;
};

export const consumerPolicyShapes: ConsumerPolicyShapes = Object.freeze({
  run: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['mode', 'maxConcurrentRuns', 'requireCleanWorkspace']),
  }),
  provisioning: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['ownershipClass', 'containmentRequired', 'dependencyInstall']),
  }),
  approval: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['mode', 'parkOnHumanLatency', 'requireRecordedDecision', 'decisionWindowMs']),
  }),
  escalationPolicy: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['allowedGrantScopes', 'maxGrantScope', 'denyByDefault', 'grantRules']),
  }),
  changePolicy: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['allowedChangePaths']),
  }),
  capabilities: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['auto-merge', 'auto-recover', 'unattended-run', 'escalation-auto-grant']),
  }),
  credentialRefs: Object.freeze({
    exposure: 'policy-source-data',
    fields: Object.freeze(['refs']),
  }),
  egress: Object.freeze({
    exposure: 'policy-source-data',
    fields: Object.freeze(['defaultAction', 'rules', 'negativeProbes', 'requiredAttesters']),
  }),
  merge: Object.freeze({
    exposure: 'desired-powers',
    fields: Object.freeze(['runnerMayPush', 'runnerMayOpenPr', 'runnerMayMerge', 'requiredEvidence', 'mergeMethod']),
  }),
});

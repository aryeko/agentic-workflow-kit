import type { PolicyLayer } from './types.js';

const packageManagerInstallPrefixes = ['pnpm install', 'pnpm add', 'npm install', 'npm ci', 'yarn install'];

export const BUILT_IN_DEFAULTS: PolicyLayer = {
  run: {
    mode: 'assisted',
    maxConcurrentRuns: 1,
    requireCleanWorkspace: true,
  },
  provisioning: {
    ownershipClass: 'owned',
    containmentRequired: true,
    dependencyInstall: {
      defaultGrant: 'narrow',
      allowedPrefixes: packageManagerInstallPrefixes,
    },
  },
  approval: {
    mode: 'assisted',
    parkOnHumanLatency: true,
    requireRecordedDecision: true,
  },
  escalationPolicy: {
    allowedGrantScopes: ['per-command', 'per-command-prefix'],
    maxGrantScope: 'per-command-prefix',
    denyByDefault: true,
    grantRules: [
      {
        reason: 'dependency-install',
        scope: 'per-command-prefix',
        prefixes: packageManagerInstallPrefixes,
        requiresOperator: false,
      },
    ],
  },
  changePolicy: {
    allowedChangePaths: [],
  },
  capabilities: {
    'auto-merge': {
      desired: false,
      requireFreshAttestation: true,
    },
    'auto-recover': {
      desired: false,
      requireFreshAttestation: true,
    },
    'unattended-run': {
      desired: false,
      requireFreshAttestation: true,
    },
  },
  credentialRefs: {
    refs: [],
  },
  egress: {
    defaultAction: 'deny',
    rules: [],
    negativeProbes: [],
    requiredAttesters: [],
  },
  merge: {
    runnerMayPush: true,
    runnerMayOpenPr: true,
    runnerMayMerge: false,
    requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
  },
};

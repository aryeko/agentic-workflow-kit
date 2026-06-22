export const configurationSchemaMarker = 'kit-vnext.config.v1' as const;
export const deferredCapabilityName = 'orchestrator-decide' as const;

export type Result<T, E> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: E;
    };

export type ValidationFailureToken = 'config-invalid' | 'unsupported-deferred-capability';

export type ValidationFailure = {
  readonly token: ValidationFailureToken;
  readonly issues: readonly string[];
};

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepPartial<Item>[]
    : {
        readonly [Key in keyof T]?: DeepPartial<T[Key]>;
      };

export type KitConfig = {
  readonly schema: typeof configurationSchemaMarker;
  readonly project: {
    readonly id: string;
    readonly rootPolicy: 'single-repo';
    readonly tracks?: readonly string[];
  };
  readonly profiles?: Readonly<Record<string, PolicyLayerPatch>>;
};

export type RunConfigInput = {
  readonly profile?: string;
  readonly overrides?: PolicyLayerPatch;
  readonly run?: {
    readonly taskId?: string;
    readonly trackId?: string;
    readonly dryRun?: boolean;
  };
};

export type RunPolicy = {
  readonly mode: 'manual' | 'assisted';
  readonly maxConcurrentRuns: number;
  readonly requireCleanWorkspace: boolean;
};

export type ProvisioningPolicy = {
  readonly ownershipClass: 'owned' | 'owned-remote' | 'observe-only';
  readonly containmentRequired: boolean;
  readonly dependencyInstall: {
    readonly defaultGrant: 'none' | 'narrow';
    readonly allowedPrefixes: readonly string[];
  };
};

export type ApprovalPolicy = {
  readonly mode: 'manual' | 'assisted';
  readonly parkOnHumanLatency: boolean;
  readonly requireRecordedDecision: boolean;
  readonly decisionWindowMs: number;
};

export type EscalationPolicy = {
  readonly allowedGrantScopes: readonly ('per-command' | 'per-command-prefix' | 'per-host' | 'session')[];
  readonly maxGrantScope: 'per-command' | 'per-command-prefix' | 'per-host' | 'session';
  readonly denyByDefault: boolean;
  readonly grantRules: readonly {
    readonly reason: 'dependency-install' | 'verification' | 'worker-tool' | 'other';
    readonly scope: 'per-command' | 'per-command-prefix';
    readonly prefixes?: readonly string[];
    readonly requiresOperator?: boolean;
  }[];
};

export type ChangePolicy = {
  readonly allowedChangePaths: readonly string[];
};

export type CredentialReferencePolicy = {
  readonly refs: readonly CredentialRefSource[];
};

export type CredentialRefSource = {
  readonly id: string;
  readonly kind: 'forge' | 'registry-read' | 'registry-publish' | 'tool-api' | 'verification';
  readonly purpose: string;
  readonly secret: {
    readonly source: 'env' | 'secret-manager';
    readonly key: string;
    readonly version?: string;
  };
  readonly allowedParties: readonly ('runner' | 'worker')[];
  readonly allowedPhases: readonly string[];
  readonly allowedHosts: readonly string[];
  readonly ttlSeconds: number;
};

export type EgressPolicySource = {
  readonly defaultAction: 'deny';
  readonly rules: readonly EgressRuleSource[];
  readonly negativeProbes: readonly NegativeProbeSource[];
  readonly requiredAttesters: readonly RequiredAttesterSource[];
};

export type EgressRuleSource = {
  readonly credentialRefIds: readonly string[];
  readonly protocols: readonly ('https' | 'ssh')[];
  readonly hosts: readonly string[];
  readonly ports?: readonly number[];
  readonly phase: string;
  readonly purpose: string;
};

export type NegativeProbeSource = {
  readonly host: string;
  readonly protocol: 'https' | 'ssh';
  readonly expected: 'blocked';
  readonly reason: string;
};

export type RequiredAttesterSource = {
  readonly point: 'execution-host';
  readonly capability: 'egress-confinement';
  readonly driverId: string;
};

export type CapabilitySetting = {
  readonly desired: boolean;
  readonly requireFreshAttestation: true;
};

export type CapabilityPolicy = {
  readonly 'auto-merge': CapabilitySetting;
  readonly 'auto-recover': CapabilitySetting;
  readonly 'unattended-run': CapabilitySetting;
  readonly 'escalation-auto-grant': CapabilitySetting;
};

export type MergePolicy = {
  readonly runnerMayPush: boolean;
  readonly runnerMayOpenPr: boolean;
  readonly runnerMayMerge: boolean;
  readonly requiredEvidence: readonly ('verification' | 'ci' | 'review' | 'threads-resolved' | 'protection')[];
  readonly mergeMethod?: 'merge' | 'squash' | 'rebase';
};

export type PolicyLayer = {
  readonly run: RunPolicy;
  readonly provisioning: ProvisioningPolicy;
  readonly approval: ApprovalPolicy;
  readonly escalationPolicy: EscalationPolicy;
  readonly changePolicy: ChangePolicy;
  readonly capabilities: CapabilityPolicy;
  readonly credentialRefs: CredentialReferencePolicy;
  readonly egress: EgressPolicySource;
  readonly merge: MergePolicy;
};

export type PolicyLayerPatch = DeepPartial<PolicyLayer>;

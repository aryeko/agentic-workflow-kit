import type { CapabilityAttestation } from '../../../providers/attestation/index.js';
import type { RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';
import { capabilityContainmentFloor } from '../registry/index.js';
import type { RecordedEvidence } from './evidence-records.js';
import { isEvidenceReplayable } from './evidence-records.js';
import type {
  AttestationRef,
  CapabilityGateFailureReason,
  CapabilityGateScope,
  CapabilityProviderScope,
  ProviderDomain,
} from './types.js';

export interface AttestationRequirementResult {
  readonly passed: boolean;
  readonly failureReason?: Extract<
    CapabilityGateFailureReason,
    | 'attestation-absent'
    | 'attestation-stale'
    | 'attestation-negative'
    | 'attestation-out-of-scope'
    | 'attestation-contradictory'
    | 'attestation-non-replayable'
    | 'attestation-insufficient-containment'
  >;
  readonly attestationRefs: readonly AttestationRef[];
  readonly evidenceRefs: readonly string[];
}

type ValidAttestationCandidate = {
  readonly envelope: RunEventEnvelope<CapabilityAttestation<string>>;
  readonly provider: ProviderDomain;
  readonly attestation: CapabilityAttestation<string>;
};

const expectedProviderByCapability = {
  canInspectProtection: 'Forge',
  supportsRulesets: 'Forge',
  supportsMergeQueue: 'Forge',
  supportsStatusWrite: 'Work Source',
  canKill: 'Execution Host',
  containmentStrength: 'Execution Host',
  preservesHostProcessParentage: 'Agent',
  supportsClaim: 'Work Source',
  'egress-confinement': 'Execution Host',
  canRelayApproval: 'Agent',
  canPersistApprovalAnswerChannel: 'Agent',
} as const satisfies Record<string, ProviderDomain>;

const hasExpectedProviderDomain = (capability: string): capability is keyof typeof expectedProviderByCapability =>
  capability in expectedProviderByCapability;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isCapabilityAttestationPayload = (value: unknown): value is CapabilityAttestation<string> =>
  isRecord(value) &&
  typeof value.capability === 'string' &&
  typeof value.probeMethod === 'string' &&
  (value.result === 'positive' || value.result === 'negative') &&
  typeof value.evidenceRef === 'string' &&
  typeof value.scope === 'string' &&
  typeof value.expiry === 'string' &&
  typeof value.driverVersion === 'string' &&
  typeof value.platform === 'string' &&
  typeof value.freshnessKey === 'string' &&
  typeof value.at === 'string';

const isLexicalParent = (parent: string, child: string): boolean => {
  if (!child.startsWith(parent)) {
    return false;
  }

  const next = child[parent.length];
  return next === '/' || next === ':' || next === '#';
};

const findMatchingProviderScope = (
  providerScopes: readonly CapabilityProviderScope[],
  provider: ProviderDomain,
  freshnessKey: string,
  scope: string,
): CapabilityProviderScope | undefined =>
  providerScopes.find((providerScope) => {
    if (providerScope.provider !== provider || providerScope.freshnessKey !== freshnessKey) {
      return false;
    }

    if (providerScope.scope === scope) {
      return true;
    }

    return providerScope.approvedParentScopes?.some(
      (parentScope) => parentScope === scope && isLexicalParent(scope, providerScope.scope),
    );
  });

const toAttestationRef = (candidate: ValidAttestationCandidate): AttestationRef => ({
  eventId: candidate.envelope.eventId,
  provider: candidate.provider,
  capability: candidate.attestation.capability,
  evidenceRef: candidate.attestation.evidenceRef,
  freshnessKey: candidate.attestation.freshnessKey,
  scope: candidate.attestation.scope,
  expiry: candidate.attestation.expiry,
});

const sortAttestationRefs = (refs: readonly AttestationRef[]): AttestationRef[] =>
  [...refs].sort((left, right) => left.eventId.localeCompare(right.eventId));

const sortEvidenceRefs = (evidenceRefs: readonly string[]): string[] =>
  [...evidenceRefs].sort((left, right) => left.localeCompare(right));

const isFreshAt = (candidate: ValidAttestationCandidate, evaluatedAt: string): boolean =>
  candidate.attestation.at <= evaluatedAt && evaluatedAt < candidate.attestation.expiry;

const isCommittedBy = (candidate: ValidAttestationCandidate, evaluatedAt: string): boolean =>
  candidate.envelope.occurredAt <= evaluatedAt && candidate.envelope.recordedAt <= evaluatedAt;

const hasPositiveConflict = (candidates: readonly ValidAttestationCandidate[]): boolean => {
  const signatures = new Set(
    candidates.map(
      (candidate) =>
        `${candidate.attestation.scope}|${candidate.attestation.freshnessKey}|${candidate.attestation.driverVersion}|${candidate.attestation.platform}|${candidate.attestation.evidenceRef}`,
    ),
  );
  return signatures.size > 1;
};

const hasSufficientContainmentStrength = (candidate: ValidAttestationCandidate): boolean => {
  if (candidate.attestation.capability !== 'containmentStrength') {
    return true;
  }

  const strength = candidate.attestation.details?.containmentStrength;
  return typeof strength === 'string' && capabilityContainmentFloor.includes(strength as never);
};

export const evaluateAttestationRequirement = (
  capability: string,
  expectedProvider: ProviderDomain,
  scope: CapabilityGateScope,
  evaluatedAt: string,
  events: readonly RunEventEnvelope[],
  recordedEvidence: ReadonlyMap<string, readonly RecordedEvidence[]>,
): AttestationRequirementResult => {
  const malformedCandidates: RunEventEnvelope[] = [];
  const validCandidates: ValidAttestationCandidate[] = [];

  for (const event of events) {
    if (event.type !== 'CapabilityAttestation') {
      continue;
    }

    const payload = event.payload;
    if (
      isCapabilityAttestationPayload(payload) &&
      payload.capability === capability &&
      event.domain === expectedProvider
    ) {
      validCandidates.push({
        envelope: {
          ...event,
          payload,
        },
        provider: expectedProvider,
        attestation: payload,
      });
      continue;
    }

    if (isRecord(payload) && payload.capability === capability && event.domain === expectedProvider) {
      malformedCandidates.push(event);
    }
  }

  if (malformedCandidates.length > 0) {
    return {
      passed: false,
      failureReason: 'attestation-non-replayable',
      attestationRefs: [],
      evidenceRefs: [],
    };
  }

  if (validCandidates.length === 0) {
    return {
      passed: false,
      failureReason: 'attestation-absent',
      attestationRefs: [],
      evidenceRefs: [],
    };
  }

  const committedCandidates = validCandidates.filter((candidate) => isCommittedBy(candidate, evaluatedAt));

  if (committedCandidates.length === 0) {
    return {
      passed: false,
      failureReason: 'attestation-absent',
      attestationRefs: [],
      evidenceRefs: [],
    };
  }

  const scopedCandidates = committedCandidates.filter(
    (candidate) =>
      findMatchingProviderScope(
        scope.providerScopes,
        candidate.provider,
        candidate.attestation.freshnessKey,
        candidate.attestation.scope,
      ) !== undefined,
  );

  if (scopedCandidates.length === 0) {
    return {
      passed: false,
      failureReason: 'attestation-out-of-scope',
      attestationRefs: [],
      evidenceRefs: [],
    };
  }

  const freshCandidates = scopedCandidates.filter((candidate) => isFreshAt(candidate, evaluatedAt));
  if (freshCandidates.length === 0) {
    return {
      passed: false,
      failureReason: 'attestation-stale',
      attestationRefs: sortAttestationRefs(scopedCandidates.map(toAttestationRef)),
      evidenceRefs: sortEvidenceRefs(scopedCandidates.map((candidate) => candidate.attestation.evidenceRef)),
    };
  }

  const negativeCandidates = freshCandidates.filter((candidate) => candidate.attestation.result === 'negative');
  const positiveCandidates = freshCandidates.filter((candidate) => candidate.attestation.result === 'positive');

  if (negativeCandidates.length > 0 && positiveCandidates.length > 0) {
    const refs = [...positiveCandidates, ...negativeCandidates].map(toAttestationRef);
    return {
      passed: false,
      failureReason: 'attestation-contradictory',
      attestationRefs: sortAttestationRefs(refs),
      evidenceRefs: sortEvidenceRefs(
        [...positiveCandidates, ...negativeCandidates].map((candidate) => candidate.attestation.evidenceRef),
      ),
    };
  }

  if (negativeCandidates.length > 0) {
    return {
      passed: false,
      failureReason: 'attestation-negative',
      attestationRefs: sortAttestationRefs(negativeCandidates.map(toAttestationRef)),
      evidenceRefs: sortEvidenceRefs(negativeCandidates.map((candidate) => candidate.attestation.evidenceRef)),
    };
  }

  if (positiveCandidates.length === 0 || hasPositiveConflict(positiveCandidates)) {
    return {
      passed: false,
      failureReason: 'attestation-contradictory',
      attestationRefs: sortAttestationRefs(positiveCandidates.map(toAttestationRef)),
      evidenceRefs: sortEvidenceRefs(positiveCandidates.map((candidate) => candidate.attestation.evidenceRef)),
    };
  }

  const nonReplayableEvidence = positiveCandidates.some((candidate) => {
    const records = recordedEvidence.get(candidate.attestation.evidenceRef);
    return records === undefined || !isEvidenceReplayable(records);
  });
  if (nonReplayableEvidence) {
    return {
      passed: false,
      failureReason: 'attestation-non-replayable',
      attestationRefs: sortAttestationRefs(positiveCandidates.map(toAttestationRef)),
      evidenceRefs: sortEvidenceRefs(positiveCandidates.map((candidate) => candidate.attestation.evidenceRef)),
    };
  }

  const insufficientContainment = positiveCandidates.some((candidate) => !hasSufficientContainmentStrength(candidate));
  if (insufficientContainment) {
    return {
      passed: false,
      failureReason: 'attestation-insufficient-containment',
      attestationRefs: sortAttestationRefs(positiveCandidates.map(toAttestationRef)),
      evidenceRefs: sortEvidenceRefs(positiveCandidates.map((candidate) => candidate.attestation.evidenceRef)),
    };
  }

  return {
    passed: true,
    attestationRefs: sortAttestationRefs(positiveCandidates.map(toAttestationRef)),
    evidenceRefs: sortEvidenceRefs(positiveCandidates.map((candidate) => candidate.attestation.evidenceRef)),
  };
};

export const deriveExpectedProviderDomain = (capability: string): ProviderDomain | undefined =>
  hasExpectedProviderDomain(capability) ? expectedProviderByCapability[capability] : undefined;

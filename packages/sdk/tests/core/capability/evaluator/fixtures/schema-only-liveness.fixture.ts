import type { CapabilityAttestation } from '../../../../../src/index.js';

import { createAllowAutoMergeScenario, createEvidenceEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();
const attestationEvidenceRefs = {
  'evt-forge-inspect': 'evidence:attestation-forge-inspect',
  'evt-forge-rulesets': 'evidence:attestation-forge-rulesets',
  'evt-forge-merge-queue': 'evidence:attestation-forge-merge-queue',
  'evt-work-source-status': 'evidence:attestation-work-source-status',
} as const;

const events = [
  createEvidenceEvent('evt-evidence-head-schema', 1, 'evidence:forge-pr-head', {
    supportKind: 'schema-only',
    value: 'schema proves field exists',
  }),
  createEvidenceEvent('evt-evidence-verify-schema', 2, 'evidence:verification', {
    supportKind: 'schema-only',
    value: 'schema proves output shape',
  }),
  createEvidenceEvent('evt-evidence-attestation-forge-inspect', 7, attestationEvidenceRefs['evt-forge-inspect'], {
    supportKind: 'probe',
    value: 'forge inspect probe',
  }),
  createEvidenceEvent('evt-evidence-attestation-forge-rulesets', 8, attestationEvidenceRefs['evt-forge-rulesets'], {
    supportKind: 'probe',
    value: 'forge rulesets probe',
  }),
  createEvidenceEvent(
    'evt-evidence-attestation-forge-merge-queue',
    9,
    attestationEvidenceRefs['evt-forge-merge-queue'],
    {
      supportKind: 'probe',
      value: 'forge merge queue probe',
    },
  ),
  createEvidenceEvent(
    'evt-evidence-attestation-work-source-status',
    10,
    attestationEvidenceRefs['evt-work-source-status'],
    {
      supportKind: 'probe',
      value: 'work source status probe',
    },
  ),
  ...base.replay.events.slice(2).map((event) =>
    event.type === 'CapabilityAttestation'
      ? {
          ...event,
          payload: {
            ...(event.payload as CapabilityAttestation<string>),
            evidenceRef:
              attestationEvidenceRefs[event.eventId as keyof typeof attestationEvidenceRefs] ??
              (event.payload as CapabilityAttestation<string>).evidenceRef,
          },
        }
      : event,
  ),
];

export const schemaOnlyLivenessFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};

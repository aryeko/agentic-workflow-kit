import type { AgentCapability, CapabilityAttestation, WorkerHandle } from '../../../src/index.js';

import { capabilityAttestationFixture, workerHandleFixture } from './fixtures/shared.js';

const capabilities = [
  'canRelayApproval',
  'canPersistApprovalAnswerChannel',
  'canResumeOwned',
  'emitsStructuredToolExit',
  'emitsGuardianReview',
  'preservesHostProcessParentage',
] satisfies readonly AgentCapability[];
const attestation = capabilityAttestationFixture() satisfies CapabilityAttestation<'canRelayApproval'>;
const worker = workerHandleFixture() satisfies WorkerHandle;

void capabilities;
void attestation;
void worker;

const invalidAgentCapabilityAttestation: CapabilityAttestation<AgentCapability> = {
  ...attestation,
  // @ts-expect-error AC-prov-01 capability must be an AgentCapability member.
  capability: 'canKill',
};

void invalidAgentCapabilityAttestation;

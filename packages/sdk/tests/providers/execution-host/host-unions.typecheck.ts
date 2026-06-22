import type { CommandKind, ContainmentStrength, HostCapability, HostFailureReason } from '../../../src/index.js';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const hostCapabilityExhaustive = (value: HostCapability): HostCapability => {
  switch (value) {
    case 'canKill':
    case 'containmentStrength':
    case 'emitsStructuredToolExit':
    case 'egress-confinement':
      return value;
    default:
      return assertNever(value);
  }
};

const containmentStrengthExhaustive = (value: ContainmentStrength): ContainmentStrength => {
  switch (value) {
    case 'none':
    case 'process-group':
    case 'kernel-tree':
    case 'job-object':
      return value;
    default:
      return assertNever(value);
  }
};

const commandKindExhaustive = (value: CommandKind): CommandKind => {
  switch (value) {
    case 'repo-setup':
    case 'verify':
    case 'diagnostic':
      return value;
    default:
      return assertNever(value);
  }
};

const hostFailureReasonExhaustive = (value: HostFailureReason): HostFailureReason => {
  switch (value) {
    case 'host-capability-unattested':
    case 'workspace-mount-unavailable':
    case 'workspace-cwd-outside-mount':
    case 'credential-injection-rejected':
    case 'egress-confinement-unattested':
    case 'worker-spawn-failed':
    case 'host-observation-incomplete':
    case 'termination-unproven':
    case 'runner-command-capture-incomplete':
    case 'credential-destroy-unconfirmed':
      return value;
    default:
      return assertNever(value);
  }
};

void hostCapabilityExhaustive;
void containmentStrengthExhaustive;
void commandKindExhaustive;
void hostFailureReasonExhaustive;

// @ts-expect-error AC-3 HostCapability admits only the design literals.
const invalidHostCapability: HostCapability = 'canResumeOwned';

// @ts-expect-error AC-3 ContainmentStrength admits only the design literals.
const invalidContainmentStrength: ContainmentStrength = 'namespace';

// @ts-expect-error AC-3 CommandKind admits only the design literals.
const invalidCommandKind: CommandKind = 'merge';

// @ts-expect-error AC-3 HostFailureReason admits only the design literals.
const invalidHostFailureReason: HostFailureReason = 'host-misconfigured';

void invalidHostCapability;
void invalidContainmentStrength;
void invalidCommandKind;
void invalidHostFailureReason;

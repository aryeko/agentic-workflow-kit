import type { CapabilityId } from '../../../../../src/core/capability/registry/index.js';

type ExtendedCapabilityId = CapabilityId | 'future-capability';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const describeCapability = (value: ExtendedCapabilityId): string => {
  switch (value) {
    case 'auto-merge':
    case 'auto-recover':
    case 'unattended-run':
    case 'escalation-auto-grant':
    case 'orchestrator-decide':
      return value;
    default:
      // @ts-expect-error AC-1 rejects a sixth capability member.
      return assertNever(value);
  }
};

void describeCapability;

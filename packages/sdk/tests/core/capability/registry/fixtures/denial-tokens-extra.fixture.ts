import type { CapabilityRegistryDenialToken } from '../../../../../src/core/capability/registry/index.js';

type ExtendedDenialToken = CapabilityRegistryDenialToken | 'future-denial-token';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const describeDenialToken = (value: ExtendedDenialToken): string => {
  switch (value) {
    case 'mode-disallows-capability':
    case 'policy-disallows-capability':
    case 'capability-deferred':
      return value;
    default:
      // @ts-expect-error AC-13 rejects a fourth denial token.
      return assertNever(value);
  }
};

void describeDenialToken;

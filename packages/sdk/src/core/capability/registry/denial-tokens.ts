export const capabilityRegistryDenialTokens = [
  'mode-disallows-capability',
  'policy-disallows-capability',
  'capability-deferred',
] as const;

export type CapabilityRegistryDenialToken = (typeof capabilityRegistryDenialTokens)[number];

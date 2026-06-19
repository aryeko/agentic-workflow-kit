import { CredentialRefSourceSchema, stableHash } from '@kit-vnext/foundation-fnd-01';
import type { CredentialRef, CredentialRefSource, EgressSource } from './types.js';

export const credentialRefFromSource = (source: CredentialRefSource): CredentialRef => {
  const parsed = CredentialRefSourceSchema.parse(source);
  return {
    ...parsed,
    allowedCommandPrefixes: [],
    secret: {
      id: stableHash({ credentialRefId: parsed.id, secret: parsed.secret }),
      ...parsed.secret,
    },
    policyDigest: stableHash(parsed),
  };
};

export const credentialRefsFromPolicy = (policy: {
  readonly credentialRefs: { readonly refs: readonly CredentialRefSource[] };
}): readonly CredentialRef[] => policy.credentialRefs.refs.map((ref) => credentialRefFromSource(ref));

export const egressSourceFromPolicy = (policy: { readonly egress: EgressSource }): EgressSource => policy.egress;

← [Back to README](./README.md)

# Risks and open questions

## Assumptions
| Assumption | Evidence | Revisit when |
| --- | --- | --- |
| Linkly V1 does not require a separate technical solution. | The example scope is a small URL shortener with one storage boundary and three delivery stories. | Requirements add multi-tenant auth, billing, compliance, or cross-system integrations. |
| Short codes are permanent in V1. | Principle P2 keeps links stable for users. | Product scope introduces expiration, deletion, or abuse-response workflows. |

## Risks
| Risk | Severity | Mitigation |
| --- | --- | --- |
| Short-code collisions as volume grows | med | Reserve enough code length; retry on collision. |
| Abuse for malicious redirects | med | Block known-bad destinations; rate-limit creation. |

## Blocking questions
- **None for the example PRD.** The V1 scope is sufficient for delivery-track planning.

## Open questions
- **Do codes expire?** — resolved: no expiry in V1 (principle P2).

---
Previous: [08-acceptance-criteria](./08-acceptance-criteria.md) · Next: [10-glossary](./10-glossary.md) · Up: [README](./README.md)

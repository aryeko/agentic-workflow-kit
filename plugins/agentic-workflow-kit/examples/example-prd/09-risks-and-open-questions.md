← [Back to README](./README.md)

# Risks and open questions

## Risks
| Risk | Severity | Mitigation |
| --- | --- | --- |
| Short-code collisions as volume grows | med | Reserve enough code length; retry on collision. |
| Abuse for malicious redirects | med | Block known-bad destinations; rate-limit creation. |

## Open questions
- **Do codes expire?** — resolved: no expiry in V1 (principle P2).

---
Previous: [08-acceptance-criteria](./08-acceptance-criteria.md) · Next: [10-glossary](./10-glossary.md) · Up: [README](./README.md)

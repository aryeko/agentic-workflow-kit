export const capabilityIds = [
  'auto-merge',
  'auto-recover',
  'unattended-run',
  'escalation-auto-grant',
  'orchestrator-decide',
] as const;

export type CapabilityId = (typeof capabilityIds)[number];

export const capabilityModes = ['manual', 'assisted'] as const;

export type CapabilityMode = (typeof capabilityModes)[number];
